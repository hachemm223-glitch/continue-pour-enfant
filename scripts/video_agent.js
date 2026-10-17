/**
 * Simple video automation agent prototype.
 *
 * Flow:
 * 1) Use a title and optional prompt
 * 2) Generate text/script from prompt (placeholder)
 * 3) Generate an audio file with ffmpeg (placeholder TTS)
 * 4) Build a simple video from a static image and audio
 * 5) Upload to YouTube via API
 * 6) Try TikTok upload using browser automation if configured
 */

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const ffmpeg = require('fluent-ffmpeg');
const { execSync } = require('child_process');

const TITLE = process.argv[2] || 'Titre automatique';
const PROMPT = process.argv[3] || 'Bonjour, ceci est une vidéo générée automatiquement.';

async function main() {
  const workdir = path.resolve('tmp');
  fs.mkdirSync(workdir, { recursive: true });

  const scriptText = PROMPT;
  const audioFile = path.join(workdir, 'voice.mp3');
  const imageFile = path.join(workdir, 'bg.jpg');
  const videoFile = path.join(workdir, 'out.mp4');

  await generateTTS(scriptText, audioFile);
  await generatePlaceholderImage(imageFile);
  await assembleVideo(imageFile, audioFile, videoFile);

  await uploadYouTube(videoFile, TITLE, scriptText);

  if (process.env.TIKTOK_UPLOAD_METHOD === 'browser') {
    await uploadTikTokBrowser(videoFile, TITLE);
  } else {
    console.log('TikTok upload skipped or not configured.');
  }

  console.log('Video agent run complete.');
}

async function generateTTS(text, outPath) {
  console.log('Generating placeholder TTS audio...');
  // TODO: replace with real TTS engine (Google Cloud, Azure, ElevenLabs, OpenAI TTS)
  // This placeholder created a 10-second silent MP3 file.
  execSync(`ffmpeg -f lavfi -i anullsrc=r=44100:cl=stereo -t 10 -q:a 9 -acodec libmp3lame "${outPath}"`, { stdio: 'inherit' });
}

async function generatePlaceholderImage(outputPath) {
  console.log('Generating placeholder background image...');
  execSync(`ffmpeg -f lavfi -i color=c=0x1d4ed8:s=1280x720:d=1 -frames:v 1 "${outputPath}"`, { stdio: 'inherit' });
}

function assembleVideo(imagePath, audioPath, outPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(audioPath, (err, metadata) => {
      if (err) return reject(err);

      const duration = metadata.format.duration || 10;

      ffmpeg()
        .addInput(imagePath)
        .loop(duration)
        .addInput(audioPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .size('1280x720')
        .outputOptions('-pix_fmt yuv420p')
        .save(outPath)
        .on('end', () => {
          console.log('Video assembled:', outPath);
          resolve();
        })
        .on('error', reject);
    });
  });
}

async function uploadYouTube(videoPath, title, description) {
  const clientId = process.env.YT_CLIENT_ID;
  const clientSecret = process.env.YT_CLIENT_SECRET;
  const refreshToken = process.env.YT_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    console.log('YouTube secrets missing. Skipping upload.');
    return;
  }

  console.log('Uploading to YouTube...');

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

  try {
    const response = await youtube.videos.insert({
      part: ['snippet', 'status'],
      requestBody: {
        snippet: {
          title,
          description,
          categoryId: '22'
        },
        status: {
          privacyStatus: 'private'
        }
      },
      media: {
        body: fs.createReadStream(videoPath)
      }
    });

    console.log('YouTube upload success:', response.data.id);
  } catch (error) {
    console.error('YouTube upload failed:');
    console.error(error.response?.data || error.message || error);
  }
}

async function uploadTikTokBrowser(videoPath, title) {
  const username = process.env.TIKTOK_USERNAME;
  const password = process.env.TIKTOK_PASSWORD;

  if (!username || !password) {
    console.log('TikTok browser upload is enabled but login credentials are missing.');
    return;
  }

  console.log('TikTok upload via browser automation is experimental.');
  console.log('This stub does not complete the full upload flow yet.');
  console.log('Video path:', videoPath);
  console.log('Title:', title);
}

main().catch((error) => {
  console.error('Video agent failed.');
  console.error(error);
  process.exit(1);
});
