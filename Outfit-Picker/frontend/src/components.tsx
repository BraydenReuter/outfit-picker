import type { FormEvent } from 'react';
import { formatType } from './constants';
import { ClothingImage } from './components/ClothingImage';
import type { ClothingItem, Outfit } from './types';

export function ClothingCard({
  item,
  onSelect,
}: {
  item: ClothingItem;
  onSelect: (item: ClothingItem) => void;
}) {
  return (
    <button
      type="button"
      className="clothing-card"
      onClick={() => onSelect(item)}
      aria-label={`View ${item.name}`}
    >
      <ClothingImage imageUrl={item.imageUrl} name={item.name} />
      <div className="card-body">
        <div className="card-topline">
          <span className="badge">{formatType(item.type)}</span>
          <span className="badge muted">{formatType(item.color)}</span>
        </div>
        <h4>{item.name}</h4>
        <p>
          {[item.brand, item.size].filter(Boolean).join(' · ') ||
            'Your collection'}
        </p>
      </div>
    </button>
  );
}

export function ClothingDetail({
  item,
  busy,
  onEdit,
  onDelete,
}: {
  item: ClothingItem;
  busy: boolean;
  onEdit: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <section className="panel detail-panel">
      <ClothingImage
        imageUrl={item.imageUrl}
        name={item.name}
        className="detail-image"
      />
      <div className="meta-list">
        <span>{formatType(item.type)}</span>
        <span>{formatType(item.color)}</span>
      </div>
      {item.description && <p>{item.description}</p>}
      <dl>
        <div>
          <dt>Brand</dt>
          <dd>{item.brand || '—'}</dd>
        </div>
        <div>
          <dt>Size</dt>
          <dd>{item.size || '—'}</dd>
        </div>
        <div>
          <dt>Added</dt>
          <dd>{new Date(item.createdAt).toLocaleDateString()}</dd>
        </div>
      </dl>
      <div className="detail-actions">
        <button
          type="button"
          className="primary-button"
          disabled={busy}
          onClick={onEdit}
        >
          Edit
        </button>
        <button
          type="button"
          className="danger-button"
          disabled={busy}
          onClick={() => onDelete(item.id)}
        >
          Delete piece
        </button>
      </div>
    </section>
  );
}

function OutfitPickList({
  label,
  items,
  selectedId,
  onSelect,
}: {
  label: string;
  items: ClothingItem[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const index = items.findIndex((item) => item.id === selectedId);
  const cycle = (direction: number) => {
    if (!items.length) return;
    const next =
      index < 0
        ? direction > 0
          ? 0
          : items.length - 1
        : (index + direction + items.length) % items.length;
    onSelect(items[next].id);
  };
  return (
    <div className="outfit-pick-group">
      <div className="outfit-pick-heading">
        <span>{label}</span>
        <div className="cycle-controls">
          <button
            type="button"
            aria-label={`Previous ${label.toLowerCase()}`}
            disabled={!items.length}
            onClick={() => cycle(-1)}
          >
            ←
          </button>
          <small aria-live="polite">
            {index >= 0
              ? `${index + 1} / ${items.length}`
              : `${items.length} ${items.length === 1 ? 'piece' : 'pieces'}`}
          </small>
          <button
            type="button"
            aria-label={`Next ${label.toLowerCase()}`}
            disabled={!items.length}
            onClick={() => cycle(1)}
          >
            →
          </button>
        </div>
      </div>
      <div
        className="outfit-pick-list"
        role="group"
        aria-label={`Choose ${label.toLowerCase()}`}
      >
        {items.length ? (
          items.map((item) => (
            <button
              type="button"
              aria-pressed={selectedId === item.id}
              className={`outfit-pick ${selectedId === item.id ? 'selected' : ''}`}
              key={item.id}
              onClick={() => onSelect(item.id)}
            >
              <ClothingImage imageUrl={item.imageUrl} name={item.name} />
              <span>{item.name}</span>
              <small>{formatType(item.type)}</small>
            </button>
          ))
        ) : (
          <p className="outfit-no-items">
            Add a {label.toLowerCase()} to start building.
          </p>
        )}
      </div>
    </div>
  );
}

function OutfitPreview({
  top,
  bottom,
}: {
  top?: ClothingItem;
  bottom?: ClothingItem;
}) {
  const piece = (item: ClothingItem | undefined, label: string) => (
    <div
      key={item?.id || label}
      className={`preview-piece preview-${label.toLowerCase()} ${item ? '' : 'preview-placeholder'}`}
    >
      {item ? (
        <>
          <ClothingImage imageUrl={item.imageUrl} name={item.name} />
          <span>{item.name}</span>
        </>
      ) : (
        <>
          <span>{label}</span>
          <small>Select a {label.toLowerCase()}</small>
        </>
      )}
    </div>
  );
  return (
    <div className="outfit-canvas">
      <div className="outfit-canvas-label">Your look</div>
      <div className="outfit-stack">
        {piece(top, 'Top')}
        <div className="outfit-join" aria-hidden="true" />
        {piece(bottom, 'Bottom')}
      </div>
    </div>
  );
}

export function OutfitBuilder({
  items,
  name,
  description,
  topId,
  bottomId,
  busy,
  loading,
  error,
  onNameChange,
  onDescriptionChange,
  onTopChange,
  onBottomChange,
  onSubmit,
}: {
  items: ClothingItem[];
  name: string;
  description: string;
  topId: string;
  bottomId: string;
  busy: boolean;
  loading: boolean;
  error: string | null;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onTopChange: (value: string) => void;
  onBottomChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const tops = items.filter((item) => item.category === 'TOP');
  const bottoms = items.filter((item) => item.category === 'BOTTOM');
  const top = tops.find((item) => item.id === topId);
  const bottom = bottoms.find((item) => item.id === bottomId);
  return (
    <section className="outfit-builder">
      <div className="builder-heading">
        <div>
          <p className="eyebrow">Create outfit</p>
          <h3>Put it together.</h3>
          <p>Pick your pieces. Find your next favorite combination.</p>
        </div>
        <span className="builder-step">
          {Number(!!top) + Number(!!bottom)} / 2 selected
        </span>
      </div>
      <div className="builder-layout">
        <OutfitPreview top={top} bottom={bottom} />
        <fieldset className="outfit-controls" disabled={busy || loading}>
          <OutfitPickList
            label="Top"
            items={tops}
            selectedId={topId}
            onSelect={onTopChange}
          />
          <OutfitPickList
            label="Bottom"
            items={bottoms}
            selectedId={bottomId}
            onSelect={onBottomChange}
          />
          <form onSubmit={onSubmit} className="outfit-form">
            <label>
              Outfit name
              <input
                value={name}
                maxLength={120}
                onChange={(event) => onNameChange(event.target.value)}
                placeholder="e.g. Saturday layers"
                required
              />
            </label>
            <label>
              Outfit notes
              <textarea
                value={description}
                maxLength={800}
                onChange={(event) => onDescriptionChange(event.target.value)}
                placeholder="Where will you wear it?"
              />
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              className="primary-button"
              disabled={busy || !top || !bottom}
            >
              {busy ? 'Saving…' : loading ? 'Loading pieces…' : 'Save outfit'}
            </button>
          </form>
        </fieldset>
      </div>
    </section>
  );
}

export function SavedOutfits({
  outfits,
  onDelete,
  onUse,
  busy,
  loading,
}: {
  outfits: Outfit[];
  onDelete: (id: string) => void;
  onUse: (outfit: Outfit) => void;
  busy: boolean;
  loading: boolean;
}) {
  return (
    <section className="saved-outfits-panel">
      <div className="saved-heading">
        <div>
          <p className="eyebrow">Your looks</p>
          <h3>Saved outfits</h3>
        </div>
        <span>{outfits.length} saved</span>
      </div>
      <div className="saved-outfits">
        {loading ? (
          <p role="status">Loading your outfits…</p>
        ) : outfits.length ? (
          outfits.map((outfit) => {
            const top = outfit.items.find(
              (item) => item.role === 'TOP',
            )?.clothingItem;
            const bottom = outfit.items.find(
              (item) => item.role === 'BOTTOM',
            )?.clothingItem;
            return (
              <article className="saved-outfit" key={outfit.id}>
                <div className="saved-outfit-preview">
                  <div>
                    {top && (
                      <ClothingImage imageUrl={top.imageUrl} name={top.name} />
                    )}
                  </div>
                  <div>
                    {bottom && (
                      <ClothingImage
                        imageUrl={bottom.imageUrl}
                        name={bottom.name}
                      />
                    )}
                  </div>
                </div>
                <div className="saved-outfit-info">
                  <strong>{outfit.name}</strong>
                  <span>
                    {top?.name} + {bottom?.name}
                  </span>
                  {outfit.description && <p>{outfit.description}</p>}
                </div>
                <div className="saved-outfit-actions">
                  <button
                    type="button"
                    className="text-button"
                    aria-label={`Use ${outfit.name} in builder`}
                    disabled={busy || !top || !bottom}
                    onClick={() => onUse(outfit)}
                  >
                    Use in builder
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    aria-label={`Delete ${outfit.name}`}
                    onClick={() => onDelete(outfit.id)}
                  >
                    Delete
                  </button>
                </div>
              </article>
            );
          })
        ) : (
          <p className="saved-empty">
            Good outfits are worth remembering. Save your first look here.
          </p>
        )}
      </div>
    </section>
  );
}
