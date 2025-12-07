import fs from 'node:fs/promises';
import path from 'node:path';
import { POST as createPatient } from '@/app/api/patients/route';
import { POST as createCapture } from '@/app/api/captures/route';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: path.resolve(process.cwd(), '.env') });

const makeRequest = (body: unknown) =>
  new Request('http://localhost/api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

async function main() {
  const imagePath = path.resolve(process.cwd(), 'test_image.jpeg');
  const imageBuffer = await fs.readFile(imagePath);
  const catheterImageUrl = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;

  const patientPayload = {
    bedNumber: '42B',
    initials: 'JD',
    insertionDate: new Date().toISOString(),
    wardId: 'CVL-01',
    patientFactors: {
      agitation: true,
      extremesAgeWeightObesity: false,
      comorbidities: true,
      immuneNutrition: false
    },
    safetyChecklist: {
      capsClosed: true,
      glovesWorn: true,
      noAbnormalities: false,
      dressingIntact: true
    }
  };

  const patientResponse = await createPatient(makeRequest(patientPayload));
  const patientJson = await patientResponse.json();
  console.log('Created patient:', patientJson.patient.id);

  const capturePayload = {
    patientId: patientJson.patient.id,
    catheterImageUrl,
    tractionCounts: { yellow: 2, red: 0 },
    events: { dressingChanged: true, catheterChanged: false, flushingDone: true },
    nightModeAssist: false,
    adaptiveTractionAlert: true
  };

  const captureResponse = await createCapture(makeRequest(capturePayload));
  const captureJson = await captureResponse.json();
  console.dir(captureJson, { depth: null });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
