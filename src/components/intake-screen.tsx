'use client';

import { ChangeEvent, DragEvent, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { AppHeader } from './app-header';
import { useTechPack } from '../app/state/tech-pack-provider';
import {
  BrowserImageNormalizationError,
  normalizeImageForGeneration,
} from '../lib/ai/image/browser-normalize';

const acceptedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const loadingStages = [
  'Analyzing reference',
  'Structuring product specification',
  'Building manufacturing draft',
  'Checking unresolved requirements',
];

interface GenerationResponse {
  techPack?: unknown;
  error?: { message?: string };
}

export function IntakeScreen() {
  const { loadChallengeFixture, setGeneratedDocument } = useTechPack();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [description, setDescription] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingStage, setLoadingStage] = useState(0);

  useEffect(() => () => {
    if (previewUrl !== null) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    if (!isGenerating) return undefined;
    const timer = window.setInterval(() => {
      setLoadingStage((current) => Math.min(current + 1, loadingStages.length - 1));
    }, 2_400);
    return () => window.clearInterval(timer);
  }, [isGenerating]);

  const selectFile = async (file: File | undefined) => {
    if (file === undefined) return;
    if (!acceptedTypes.has(file.type)) {
      setError('Use a JPEG, PNG, or WebP image.');
      return;
    }
    try {
      const normalized = await normalizeImageForGeneration(file);
      setError(null);
      setSelectedFile(normalized);
      setFileName(normalized.name);
      setPreviewUrl((current) => {
        if (current !== null) URL.revokeObjectURL(current);
        return URL.createObjectURL(normalized);
      });
    } catch (normalizationError) {
      setSelectedFile(null);
      setFileName(null);
      setError(
        normalizationError instanceof BrowserImageNormalizationError
          ? normalizationError.message
          : 'This image could not be processed.',
      );
    }
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => selectFile(event.target.files?.[0]);
  const onDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    selectFile(event.dataTransfer.files[0]);
  };
  const loadExample = () => {
    loadChallengeFixture();
    router.push('/workspace');
  };
  const generate = async () => {
    const trimmedDescription = description.trim();
    if (selectedFile === null || trimmedDescription.length < 3) {
      setError('Add a product image and description before generating.');
      return;
    }
    setError(null);
    setLoadingStage(0);
    setIsGenerating(true);
    try {
      const formData = new FormData();
      formData.set('buyerDescription', trimmedDescription);
      formData.set('image', selectedFile);
      const response = await fetch('/api/tech-packs/generate', { method: 'POST', body: formData });
      const payload = await response.json().catch(() => ({})) as GenerationResponse;
      if (!response.ok || payload.techPack === undefined) {
        throw new Error(payload.error?.message ?? 'We could not generate the tech pack right now. Please try again.');
      }
      setGeneratedDocument(payload.techPack as Parameters<typeof setGeneratedDocument>[0]);
      router.push('/workspace');
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : 'We could not generate the tech pack right now. Please try again.',
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <main className="intake-page">
      <AppHeader compact />
      <section className="intake-hero">
        <p className="eyebrow">DRAFTING TABLE</p>
        <h1>Create a reviewable technical draft.</h1>
        <p className="intake-intro">Start with one reference image and the buyer&apos;s description.</p>
      </section>
      <section className="intake-card" aria-labelledby="intake-title">
        <div className="intake-card__header">
          <div>
            <p className="eyebrow">01 / INPUT EVIDENCE</p>
            <h2 id="intake-title">Create new tech pack</h2>
          </div>
          <span className="draft-label">DRAFT WORKFLOW</span>
        </div>
        <div className="intake-grid">
          <div>
            <p className="field-label">Reference image <span>ONE FILE</span></p>
            <button
              className="upload-zone"
              type="button"
              disabled={isGenerating}
              onClick={() => inputRef.current?.click()}
              onDragOver={(event) => event.preventDefault()}
              onDrop={onDrop}
            >
              {previewUrl === null ? <><span className="upload-icon">↑</span><strong>Drop image or browse</strong><span>JPEG, PNG, or WebP</span></> : <img src={previewUrl} alt="Selected garment reference" />}
            </button>
            <input ref={inputRef} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={onFileChange} disabled={isGenerating} />
            <p className="file-caption">{fileName ?? 'No image selected yet.'}</p>
            {error !== null ? <p className="form-error" role="alert">{error}</p> : null}
          </div>
          <label className="description-field">
            <span className="field-label">Buyer description</span>
            <textarea value={description} maxLength={5000} disabled={isGenerating} onChange={(event) => setDescription(event.target.value)} placeholder="Describe the product, materials, sizes, colour configuration, and requested construction details." />
            <span className="field-help">Include materials, sizes, colours, and requested construction details where known.</span>
          </label>
        </div>
        <div className="intake-actions">
          <button className="button button--primary" type="button" disabled={isGenerating} onClick={generate}>{isGenerating ? 'Generating…' : <>Generate tech pack <span>→</span></>}</button>
          {isGenerating ? <p className="generation-status" role="status">{loadingStages[loadingStage]}</p> : null}
        </div>
        <footer className="example-footer">
          <div><p className="eyebrow">TRY THE EXAMPLE</p><strong>Reversible Cotton Bucket Hat</strong><span>Khaki / Black</span></div>
          <button className="button button--secondary" type="button" disabled={isGenerating} onClick={loadExample}>Load example</button>
        </footer>
      </section>
    </main>
  );
}
