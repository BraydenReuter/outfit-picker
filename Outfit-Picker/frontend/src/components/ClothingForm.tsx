import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from 'react';
import { discardProcessedImage, removeBackground } from '../api/imageApi';
import { resolveAssetUrl } from '../api/apiClient';
import { transformImage, isSupportedImageType } from '../utils/imageTransform';
import {
  colorOptions,
  formatType,
  typeOptions,
  type ClothingFormValues,
} from '../constants';
import type { ClothingCategory, ClothingType, ColorName } from '../types';

export function ClothingForm({
  values,
  editing,
  error,
  busy,
  onBusyChange,
  onChange,
  onSubmit,
  onCancel,
}: {
  values: ClothingFormValues;
  editing: boolean;
  error: string | null;
  busy: boolean;
  onBusyChange: (value: boolean) => void;
  onChange: Dispatch<SetStateAction<ClothingFormValues>>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState('');
  const [stage, setStage] = useState<'idle' | 'preparing' | 'processing'>(
    'idle',
  );
  const [imageError, setImageError] = useState<string | null>(null);
  const temporaryImages = useRef(new Set<string>());
  const locked = busy || stage !== 'idle';
  const update = <K extends keyof ClothingFormValues>(
    key: K,
    value: ClothingFormValues[K],
  ) => {
    onChange((current) => ({ ...current, [key]: value }));
  };

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  useEffect(() => {
    const images = temporaryImages.current;
    return () => {
      // The API keeps any photo that was saved to a piece before the form closed.
      images.forEach((url) => {
        void discardProcessedImage(url).catch(() => {});
      });
    };
  }, []);

  const prepare = async (selected: File, turns = 0) => {
    if (locked) return;
    setImageError(null);
    if (
      !isSupportedImageType(selected.type) ||
      selected.size > 10 * 1024 * 1024
    ) {
      setImageError('Choose a JPEG, PNG, or WebP image up to 10 MB.');
      return;
    }
    setStage('preparing');
    onBusyChange(true);
    try {
      const prepared = await transformImage(selected, turns);
      setFile(prepared);
      setPreview(URL.createObjectURL(prepared));
      update('imageUrl', '');
    } catch (error) {
      setImageError(
        error instanceof Error
          ? error.message
          : 'This photo could not be opened.',
      );
    } finally {
      setStage('idle');
      onBusyChange(false);
    }
  };

  const process = async () => {
    if (!file || locked) return;
    setStage('processing');
    onBusyChange(true);
    setImageError(null);
    try {
      const result = await removeBackground(file);
      temporaryImages.current.add(result.imageUrl);
      update('imageUrl', result.imageUrl);
    } catch (error) {
      setImageError(
        error instanceof Error
          ? error.message
          : 'Background removal failed. Try another photo.',
      );
    } finally {
      setStage('idle');
      onBusyChange(false);
    }
  };

  const removePhoto = () => {
    setFile(null);
    setPreview('');
    setImageError(null);
    update('imageUrl', '');
    if (fileInput.current) fileInput.current.value = '';
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    if (locked || (file && !values.imageUrl)) {
      event.preventDefault();
      if (!locked)
        setImageError('Process your photo and review it before saving.');
      return;
    }
    onSubmit(event);
  };

  return (
    <section className="panel form-panel">
      <form className="clothing-form" onSubmit={submit}>
        <fieldset disabled={locked}>
          <div className="image-upload-area">
            <div>
              <p className="eyebrow">01 · Add a photo</p>
              <p className="upload-hint">
                Photograph one piece laid flat or on a hanger. A photo of
                someone wearing it may keep the person, too.
              </p>
            </div>
            <label>
              Clothing photo
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => {
                  const selected = event.target.files?.[0];
                  if (selected) void prepare(selected);
                }}
              />
            </label>
            <small>JPEG, PNG or WebP · up to 10 MB · photo optional</small>
            {(file || values.imageUrl) && (
              <button
                type="button"
                className="text-button"
                onClick={removePhoto}
              >
                Remove photo
              </button>
            )}
            <div className="photo-comparison">
              {preview && (
                <div className="image-preview">
                  <span>Original</span>
                  <img src={preview} alt="Original clothing photo" />
                </div>
              )}
              {values.imageUrl && (
                <div className="processed-preview">
                  <span>Ready to save</span>
                  <img
                    src={resolveAssetUrl(values.imageUrl)}
                    alt="Processed clothing preview"
                  />
                </div>
              )}
            </div>
            {file && (
              <div className="image-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => void prepare(file, -1)}
                >
                  ↶ Rotate left
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => void prepare(file, 1)}
                >
                  Rotate right ↷
                </button>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => void process()}
                >
                  {stage === 'processing'
                    ? 'Removing background…'
                    : 'Process image'}
                </button>
              </div>
            )}
            {stage !== 'idle' && (
              <p className="processing-status" role="status">
                <span className="spinner" />
                {stage === 'preparing'
                  ? 'Preparing your photo…'
                  : 'Removing the background. This can take a couple of minutes on a laptop.'}
              </p>
            )}
            {imageError && (
              <p className="form-error" role="alert">
                {imageError}
              </p>
            )}
          </div>
          <p className="eyebrow">02 · The details</p>
          <label>
            Name
            <input
              value={values.name}
              maxLength={120}
              onChange={(event) => update('name', event.target.value)}
              placeholder="e.g. Everyday white tee"
              required
            />
          </label>
          <div className="form-grid">
            <label>
              Category
              <select
                value={values.category}
                onChange={(event) => {
                  const category = event.target.value as ClothingCategory;
                  onChange((current) => ({
                    ...current,
                    category,
                    type: typeOptions[category][0],
                  }));
                }}
              >
                <option value="TOP">Top</option>
                <option value="BOTTOM">Bottom</option>
              </select>
            </label>
            <label>
              Type
              <select
                value={values.type}
                onChange={(event) =>
                  update('type', event.target.value as ClothingType)
                }
              >
                {typeOptions[values.category].map((type) => (
                  <option key={type} value={type}>
                    {formatType(type)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Color
              <select
                value={values.color}
                onChange={(event) =>
                  update('color', event.target.value as ColorName)
                }
              >
                {colorOptions.map((color) => (
                  <option key={color} value={color}>
                    {formatType(color)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Size
              <input
                value={values.size}
                maxLength={40}
                placeholder="e.g. M or 32"
                onChange={(event) => update('size', event.target.value)}
              />
            </label>
          </div>
          <label>
            Brand
            <input
              value={values.brand}
              maxLength={80}
              onChange={(event) => update('brand', event.target.value)}
            />
          </label>
          <label>
            Notes
            <textarea
              value={values.description}
              maxLength={800}
              placeholder="Fit, fabric, or anything worth remembering"
              onChange={(event) => update('description', event.target.value)}
            />
          </label>
        </fieldset>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="detail-actions">
          <button
            type="submit"
            className="primary-button"
            disabled={locked || (!!file && !values.imageUrl)}
          >
            {busy && stage === 'idle'
              ? 'Saving…'
              : editing
                ? 'Update item'
                : 'Save item'}
          </button>
          <button
            type="button"
            className="secondary-button"
            disabled={locked}
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}
