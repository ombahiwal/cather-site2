"use client";

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import PageShell from '@/components/PageShell';
import WorkflowGuard from '@/components/WorkflowGuard';
import { useWorkflow } from '@/context/WorkflowContext';

const sources: Record<'English' | 'Vernacular', string> = {
  English: '/audio/consent-en.wav',
  Vernacular: '/audio/consent-vernacular.wav'
};

const transcripts: Record<'English' | 'Vernacular', string> = {
  English:
    'You are authorizing the CathShield nursing team to capture and analyze catheter images for infection prevention. The capture does not expose your identity and can be stopped at any time if you withdraw consent.',
  Vernacular:
    'आप कैथशील्ड नर्सिंग टीम को कैथेटर स्थल की फोटो लेने और संक्रमण रोकथाम के लिये उसका विश्लेषण करने की अनुमति दे रहे हैं। यह रिकॉर्ड आपकी पहचान साझा नहीं करता और आप किसी भी समय सहमति वापस ले सकते हैं।'
};

export default function ConsentPage() {
  const router = useRouter();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [language, setLanguage] = useState<'English' | 'Vernacular'>('English');
  const [status, setStatus] = useState<'idle' | 'playing' | 'completed'>('idle');
  const [consentChecked, setConsentChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const { patientId, advanceTo } = useWorkflow();

  const playAudio = async (selected: 'English' | 'Vernacular') => {
    setLanguage(selected);
    setConsentChecked(false);
    setStatus('playing');
    const audio = audioRef.current;
    if (audio) {
      audio.src = sources[selected];
      audio.currentTime = 0;
      await audio.play();
    }
  };

  const handleContinue = async () => {
    if (!patientId) return;
    setSaving(true);
    await fetch('/api/consent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId, audioLanguageUsed: language })
    });
    advanceTo('capture');
    router.push('/capture');
  };

  const completed = status === 'completed' && consentChecked;

  return (
    <WorkflowGuard requiredStage="consent">
      <PageShell title="Mandatory Audio Consent" subtitle="Play before every capture">
        <div className="card space-y-3">
          <audio ref={audioRef} onEnded={() => setStatus('completed')} />
          <button
            type="button"
            onClick={() => playAudio('English')}
            className="w-full rounded-full bg-teal text-white py-3 font-semibold"
          >
            Play English Consent Audio
          </button>
          <button
            type="button"
            onClick={() => playAudio('Vernacular')}
            className="w-full rounded-full border border-slate-200 py-3 font-semibold"
          >
            Play Vernacular Consent
          </button>
          <p className="text-sm text-slate-600">
            Status: {status === 'idle' ? 'Ready' : status === 'playing' ? 'Playing...' : 'Completed'}
          </p>
          <div className="rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-700" aria-live="polite">
            <p className="font-semibold text-slate-900">Consent transcript ({language})</p>
            <p>{transcripts[language]}</p>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              disabled={status !== 'completed'}
              checked={consentChecked}
              onChange={(event) => setConsentChecked(event.target.checked)}
            />
            I have explained and obtained patient / guardian consent.
          </label>
          <button
            type="button"
            disabled={!completed || saving || !patientId}
            onClick={handleContinue}
            className="w-full rounded-full bg-medical text-white py-3 font-semibold"
          >
            Continue to 12-Hourly Capture
          </button>
        </div>
      </PageShell>
    </WorkflowGuard>
  );
}
