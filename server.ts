import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const APP_VERSION = '2.4.0';

function getGenAI() {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const LEAD_SHEET_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: 'Song title extracted from the lead sheet.' },
    artist: { type: Type.STRING, description: 'Composer or artist if present, otherwise Traditional or Unknown.' },
    key: { type: Type.STRING, description: 'Musical key signature (e.g., C, G, Am, F, Bb).' },
    tempo: { type: Type.INTEGER, description: 'Tempo in BPM (e.g., 90, 110, 120).' },
    time: { type: Type.STRING, description: 'Time signature (e.g., 4/4, 3/4, 6/8).' },
    chordPro: {
      type: Type.STRING,
      description:
        'Complete ChordPro formatted song text including {title: ...}, {artist: ...}, {key: ...}, {tempo: ...}, {time: ...}, section tags like {start_of_verse}/{end_of_verse} or {start_of_chorus}/{end_of_chorus}, and inline bracketed chords like [C]Lyric [G]words.',
    },
    melody: {
      type: Type.OBJECT,
      description: 'Extracted or transcribed lead melody with MIDI note numbers, beat positions, durations, lyric syllables, and harmony chords.',
      properties: {
        beats: { type: Type.NUMBER, description: 'Total length of the melody in beats (e.g., 16, 32, 64).' },
        notes: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              midi: { type: Type.INTEGER, description: 'MIDI pitch number (e.g., 60 for C4, 67 for G4).' },
              beat: { type: Type.NUMBER, description: 'Start beat position (0-indexed, e.g., 0, 1, 2.5).' },
              dur: { type: Type.NUMBER, description: 'Duration in beats (e.g., 0.5, 1, 2).' },
              syllable: { type: Type.STRING, description: 'Lyric word or syllable sung on this note.' },
            },
            required: ['midi', 'beat', 'dur'],
          },
        },
        harmony: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              beat: { type: Type.NUMBER, description: 'Beat position where this chord starts (0-indexed).' },
              chord: { type: Type.STRING, description: 'Chord symbol (e.g., C, G7, Am, F).' },
            },
            required: ['beat', 'chord'],
          },
        },
      },
      required: ['beats', 'notes', 'harmony'],
    },
  },
  required: ['title', 'key', 'tempo', 'time', 'chordPro', 'melody'],
};

/**
 * Builds a single self-contained HTML string from `dist/` with all CSS and JS inlined
 * so that the Expo Android APK can render 100% of the exact web app offline and online.
 */
async function buildInlinedHtmlBundle(): Promise<string> {
  const distDir = path.join(__dirname, 'dist');
  const indexHtmlPath = path.join(distDir, 'index.html');

  if (!fs.existsSync(indexHtmlPath)) {
    const { build } = await import('vite');
    await build();
  }

  let html = fs.readFileSync(indexHtmlPath, 'utf-8');
  const assetsDir = path.join(distDir, 'assets');

  if (fs.existsSync(assetsDir)) {
    const files = fs.readdirSync(assetsDir);
    const cssFiles = files.filter((f) => f.endsWith('.css'));
    const jsFiles = files.filter((f) => f.endsWith('.js'));

    let inlinedCss = '';
    for (const cssFile of cssFiles) {
      inlinedCss += fs.readFileSync(path.join(assetsDir, cssFile), 'utf-8') + '\n';
    }

    let inlinedJs = '';
    for (const jsFile of jsFiles) {
      inlinedJs += fs.readFileSync(path.join(assetsDir, jsFile), 'utf-8') + '\n';
    }

    // Remove external <link rel="stylesheet" href="/assets/..."> and <script ... src="/assets/...">
    html = html.replace(/<link[^>]+href="\/assets\/[^"]+\.css"[^>]*>/g, '');
    html = html.replace(/<script[^>]+src="\/assets\/[^"]+\.js"[^>]*><\/script>/g, '');

    // Inject inlined CSS in <head> and inlined JS at end of <body>
    html = html.replace('</head>', `<style>${inlinedCss}</style></head>`);
    // Escape any literal </script> inside the JS bundle so HTML parser doesn't close early
    const safeJs = inlinedJs.replace(/<\/script>/gi, '<\\/script>');
    html = html.replace('</body>', `<script type="module">${safeJs}</script></body>`);
  }

  return html;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  // Allow CORS for mobile OTA checks
  app.use('/api', (_req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    next();
  });

  // OTA Version Check Endpoint
  app.get('/api/ota-version', (_req, res) => {
    res.json({
      version: APP_VERSION,
      builtAt: new Date().toISOString(),
    });
  });

  // Full Inlined HTML Bundle for OTA Self-Updating APK
  app.get('/api/ota-bundle', async (_req, res) => {
    try {
      const html = await buildInlinedHtmlBundle();
      res.json({
        version: APP_VERSION,
        html,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to build OTA bundle' });
    }
  });

  // Generates the complete Expo `src/app/index.tsx` file containing both the full app bundle + startup auto-updater
  app.get('/api/expo-index.tsx', async (_req, res) => {
    try {
      const html = await buildInlinedHtmlBundle();
      const encodedHtml = JSON.stringify(html);
      const appUrl =
        process.env.APP_URL ||
        'https://ais-pre-3f2v4fe7ip5soanvyhmnzh-493938691625.us-east5.run.app';

      const expoTsx = `import React, { useEffect, useState } from 'react';
import { SafeAreaView, StatusBar, StyleSheet, Text, View, Platform } from 'react-native';
import { WebView } from 'react-native-webview';

const BUNDLED_VERSION = '${APP_VERSION}';
const SERVER_ORIGIN = '${appUrl}';
const EMBEDDED_APP_HTML: string = ${encodedHtml};

export default function HopeSongbookMasterApp() {
  const [htmlContent, setHtmlContent] = useState<string>(EMBEDDED_APP_HTML);
  const [updateBanner, setUpdateBanner] = useState<string | null>('Checking for updates…');

  useEffect(() => {
    let mounted = true;

    async function checkStartupUpdates() {
      // 1. Check Expo EAS OTA Updates (expo-updates) if installed in build
      try {
        const Updates = require('expo-updates');
        if (Updates && Updates.isEnabled) {
          const update = await Updates.checkForUpdateAsync();
          if (update.isAvailable) {
            if (mounted) setUpdateBanner('Downloading new update…');
            await Updates.fetchUpdateAsync();
            await Updates.reloadAsync();
            return;
          }
        }
      } catch {
        // expo-updates not active or dev mode
      }

      // 2. Check remote bundle endpoint
      try {
        const res = await fetch(SERVER_ORIGIN + '/api/ota-bundle');
        if (res.ok) {
          const data = await res.json();
          if (data && data.html && data.version && data.version !== BUNDLED_VERSION) {
            if (mounted) {
              setUpdateBanner('Updated to v' + data.version);
              setHtmlContent(data.html);
            }
          }
        }
      } catch {
        // Offline or unreachable — use embedded bundle seamlessly
      }

      if (mounted) {
        setUpdateBanner('✓ Hope Songbook v' + BUNDLED_VERSION + ' · Up to date');
        setTimeout(() => {
          if (mounted) setUpdateBanner(null);
        }, 1600);
      }
    }

    checkStartupUpdates();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0b0d12" />
      {updateBanner && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{updateBanner}</Text>
        </View>
      )}
      <WebView
        originWhitelist={['*']}
        source={{ html: htmlContent, baseUrl: SERVER_ORIGIN }}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        mixedContentMode="always"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0b0d12',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0,
  },
  banner: {
    backgroundColor: '#12161f',
    borderBottomWidth: 1,
    borderBottomColor: '#283042',
    paddingVertical: 6,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  bannerText: {
    color: '#4fd18b',
    fontSize: 12,
    fontWeight: '700',
  },
  webview: {
    flex: 1,
    backgroundColor: '#0b0d12',
  },
});
`;

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="index.tsx"');
      res.send(expoTsx);
    } catch (err: any) {
      res.status(500).send('// Error generating Expo index.tsx: ' + (err?.message || 'Unknown'));
    }
  });

  // Parse PDF or Image Lead Sheet into ChordPro + Melody
  app.post('/api/parse-leadsheet', async (req, res) => {
    try {
      const { base64Data, mimeType, fileName, textContent } = req.body;
      const ai = getGenAI();

      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

      if (base64Data && mimeType) {
        parts.push({
          inlineData: {
            mimeType,
            data: base64Data,
          },
        });
      }

      const prompt = textContent
        ? `Convert the following song sheet or lead sheet text from "${fileName || 'imported file'}" into a complete ChordPro document AND extract/compose a playable lead melody (MIDI notes, beat positions, durations, lyric syllables, and harmony chords) that matches the chords and lyrics.\n\nSource text:\n${textContent}`
        : `Transcribe this musical lead sheet / PDF / score ("${fileName || 'lead-sheet.pdf'}") into a complete ChordPro document with inline [Chords] and lyrics, AND transcribe its vocal/lead melody into MIDI note numbers (where 60 = C4), 0-indexed beat positions, durations in beats, lyric syllables, and harmony chord changes. Ensure at least 16 to 32 beats of accurate playable melody notes.`;

      parts.push({ text: prompt });

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: { parts },
        config: {
          systemInstruction:
            'You are an expert musicologist, Optical Music Recognition (OMR) transcriber, and ChordPro arranger. Always return valid JSON matching the requested schema with both rich ChordPro lyrics/chords and a playable MIDI melody array.',
          responseMimeType: 'application/json',
          responseSchema: LEAD_SHEET_SCHEMA,
        },
      });

      const jsonText = (response.text ?? '{}').trim();
      const parsed = JSON.parse(jsonText);
      res.json(parsed);
    } catch (error: any) {
      console.error('Error parsing lead sheet:', error);
      res.status(500).json({
        error: error?.message || 'Failed to transcribe lead sheet with Gemini.',
      });
    }
  });

  // Compose or extract playable SongMelody from an existing ChordPro song
  app.post('/api/generate-melody', async (req, res) => {
    try {
      const { chordPro } = req.body;
      if (!chordPro) {
        res.status(400).json({ error: 'Missing chordPro source text.' });
        return;
      }

      const ai = getGenAI();
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Analyze this ChordPro song and transcribe/compose an idiomatic, singable lead-sheet vocal melody (MIDI notes in range 55..76, 0-indexed beat positions, durations, lyric syllables, and harmony chord markers) synchronized to the song's key, time signature, chord progression, and lyrics.\n\nChordPro:\n${chordPro}`,
        config: {
          systemInstruction:
            'You are an expert musical arranger. Given a ChordPro song, generate a rhythmic, melodic lead line (24 to 48 notes) whose pitches fit the underlying chords and whose syllables match the song lyrics.',
          responseMimeType: 'application/json',
          responseSchema: LEAD_SHEET_SCHEMA,
        },
      });

      const jsonText = (response.text ?? '{}').trim();
      const parsed = JSON.parse(jsonText);
      res.json(parsed);
    } catch (error: any) {
      console.error('Error generating melody:', error);
      res.status(500).json({
        error: error?.message || 'Failed to generate lead melody.',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Hope Songbook server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
