import type { ImageSignals } from './riskEngine';

const DEFAULT_GEMINI_MODEL = 'gemini-1.5-flash-latest';
const PROMPT = `You are a vascular access specialist reviewing a catheter insertion site photo.
Score each feature from 0-3 (0 = none, 3 = severe) and respond with compact JSON only:
{"erythema":0-3,"drainage":0-3,"ooze":0-3,"moisture":0-3,"dressingLift":0-100,"chgPatch":true|false,"maceration":true|false}`;

const extractBase64 = (dataUrl: string) => {
  const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!match) return { mimeType: 'image/jpeg', data: dataUrl };
  return { mimeType: match[1], data: match[2] };
};

const parseSignals = (text?: string): ImageSignals | null => {
  if (!text) return null;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const signals: ImageSignals = {
      erythema: Number(parsed.erythema) || 0,
      drainage: Number(parsed.drainage) || 0,
      ooze: Number(parsed.ooze) || 0,
      moisture: Number(parsed.moisture) || 0,
      dressingLift: Number(parsed.dressingLift) || 0,
      chgPatch: Boolean(parsed.chgPatch),
      maceration: Boolean(parsed.maceration)
    };
    return signals;
  } catch (error) {
    console.error('Failed to parse Gemini JSON', error);
    return null;
  }
};

export async function analyzeCatheterImage(imageDataUrl: string): Promise<ImageSignals | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('GEMINI_API_KEY is not set; falling back to deterministic signals.');
    return null;
  }

  const { data, mimeType } = extractBase64(imageDataUrl);
  if (!data) {
    return null;
  }

  const endpoint = process.env.GEMINI_API_URL ??
    `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL}:generateContent`;

  try {
    const response = await fetch(`${endpoint}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: PROMPT },
              { inline_data: { mime_type: mimeType, data } }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      console.error('Gemini request failed', await response.text());
      return null;
    }

    const payload = await response.json();
    const text: string | undefined = payload?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text)
      .filter(Boolean)
      .join('\n');

    return parseSignals(text);
  } catch (error) {
    console.error('Gemini request error', error);
    return null;
  }
}
