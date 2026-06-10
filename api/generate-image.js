// api/generate-image.js
// Stability AI stable-image/generate/core — Buffer 기반 multipart

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { prompt, aspectRatio = '16:9' } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'prompt is required' });

  const apiKey = process.env.STABILITY_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'STABILITY_API_KEY not set' });

  const fullPrompt = `${prompt}, realistic photograph, high quality, natural lighting, no text, no watermark`;
  const negPrompt  = 'blurry, distorted, cartoon, anime, text, watermark, low quality, nsfw';

  try {
    // Buffer 기반 multipart/form-data 구성
    const boundary = 'StabilityBoundary' + Date.now();
    const CRLF = '\r\n';

    function part(name, value) {
      return Buffer.concat([
        Buffer.from(`--${boundary}${CRLF}`),
        Buffer.from(`Content-Disposition: form-data; name="${name}"${CRLF}${CRLF}`),
        Buffer.from(String(value)),
        Buffer.from(CRLF),
      ]);
    }

    const body = Buffer.concat([
      part('prompt',          fullPrompt),
      part('negative_prompt', negPrompt),
      part('aspect_ratio',    aspectRatio),
      part('style_preset',    'photographic'),
      part('output_format',   'jpeg'),
      Buffer.from(`--${boundary}--${CRLF}`),
    ]);

    const stabilityRes = await fetch(
      'https://api.stability.ai/v2beta/stable-image/generate/core',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept:        'image/*',
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': String(body.length),
        },
        body,
      }
    );

    if (!stabilityRes.ok) {
      const errText = await stabilityRes.text();
      console.error('Stability AI error:', stabilityRes.status, errText);
      // Stability 실패 시 Unsplash 폴백 URL 반환
      const kw = encodeURIComponent(prompt.split(',')[0].trim());
      return res.status(200).json({
        imageUrl: `https://source.unsplash.com/1200x675/?${kw}`,
        fallback: true,
      });
    }

    const buf    = Buffer.from(await stabilityRes.arrayBuffer());
    const base64 = buf.toString('base64');
    return res.status(200).json({ imageUrl: `data:image/jpeg;base64,${base64}` });

  } catch (err) {
    console.error('generate-image error:', err);
    // 에러 시도 Unsplash 폴백
    const kw = encodeURIComponent((prompt || 'office').split(',')[0].trim());
    return res.status(200).json({
      imageUrl: `https://source.unsplash.com/1200x675/?${kw}`,
      fallback: true,
    });
  }
};
