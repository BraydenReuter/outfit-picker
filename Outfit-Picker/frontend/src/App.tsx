import { useEffect, useMemo, useState, type FormEvent } from 'react';
import './App.css';
import {
  createClothingItem,
  deleteClothingItem,
  fetchClothingItems,
  updateClothingItem,
} from './api/clothingApi';
import { createOutfit, deleteOutfit, fetchOutfits } from './api/outfitApi';
import {
  colorOptions,
  formatType,
  type ClothingFormValues,
  typeOptions,
} from './constants';
import {
  ClothingCard,
  ClothingDetail,
  OutfitBuilder,
  SavedOutfits,
} from './components';
import { ClothingForm } from './components/ClothingForm';
import { Dialog } from './components/Dialog';
import { EmptyWardrobe } from './components/EmptyWardrobe';
import type {
  ClothingCategory,
  ClothingItem,
  ClothingType,
  ColorName,
  Outfit,
} from './types';

const emptyForm: ClothingFormValues = {
  name: '',
  category: 'TOP',
  type: 'T_SHIRT',
  color: 'BLACK',
  brand: '',
  size: '',
  imageUrl: '',
  description: '',
};
const message = (error: unknown) =>
  error instanceof Error
    ? error.message
    : 'Something went wrong. Please try again.';

function App() {
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [allItems, setAllItems] = useState<ClothingItem[]>([]);
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [category, setCategory] = useState<'ALL' | ClothingCategory>('ALL');
  const [type, setType] = useState<'ALL' | ClothingType>('ALL');
  const [color, setColor] = useState<'ALL' | ColorName>('ALL');
  const [brand, setBrand] = useState('');
  const [size, setSize] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<
    'newest' | 'oldest' | 'name-asc' | 'name-desc'
  >('newest');
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [collectionLoading, setCollectionLoading] = useState(true);
  const [collectionError, setCollectionError] = useState<string | null>(null);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [outfitError, setOutfitError] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [selectedItem, setSelectedItem] = useState<ClothingItem | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formState, setFormState] = useState<ClothingFormValues>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [savingOutfit, setSavingOutfit] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    kind: 'clothing' | 'outfit';
  } | null>(null);
  const [activeSection, setActiveSection] = useState('wardrobe');
  const [outfitName, setOutfitName] = useState('');
  const [outfitDescription, setOutfitDescription] = useState('');
  const [outfitTop, setOutfitTop] = useState('');
  const [outfitBottom, setOutfitBottom] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetchClothingItems({}, controller.signal),
      fetchOutfits(controller.signal),
    ])
      .then(([clothes, looks]) => {
        if (!controller.signal.aborted) {
          setAllItems(clothes);
          setOutfits(looks);
          setCollectionError(null);
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setCollectionError(message(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setCollectionLoading(false);
      });
    return () => controller.abort();
  }, [revision]);

  useEffect(() => {
    const controller = new AbortController();
    // Don't let a slower, older search replace the one the user just typed.
    const timer = setTimeout(() => {
      setLoading(true);
      fetchClothingItems(
        {
          category: category === 'ALL' ? undefined : category,
          type: type === 'ALL' ? undefined : type,
          color: color === 'ALL' ? undefined : color,
          brand,
          size,
          search,
          sort,
        },
        controller.signal,
      )
        .then((clothes) => {
          if (!controller.signal.aborted) {
            setItems(clothes);
            setFilterError(null);
          }
        })
        .catch((error: unknown) => {
          if (!controller.signal.aborted) setFilterError(message(error));
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [category, type, color, brand, size, search, sort, revision]);

  const stats = useMemo(
    () => ({
      total: allItems.length,
      tops: allItems.filter((item) => item.category === 'TOP').length,
      bottoms: allItems.filter((item) => item.category === 'BOTTOM').length,
    }),
    [allItems],
  );
  const hasFilters = !!(
    search ||
    category !== 'ALL' ||
    type !== 'ALL' ||
    color !== 'ALL' ||
    brand ||
    size
  );
  const resetFilters = () => {
    setSearch('');
    setCategory('ALL');
    setType('ALL');
    setColor('ALL');
    setBrand('');
    setSize('');
  };
  const refresh = () => {
    setCollectionLoading(true);
    setLoading(true);
    setRevision((value) => value + 1);
  };
  const closeForm = () => {
    if (!saving && !imageBusy) {
      setFormOpen(false);
      setEditingId(null);
      setFormError(null);
    }
  };
  const addClothing = () => {
    setSelectedItem(null);
    setEditingId(null);
    setFormState({ ...emptyForm });
    setFormError(null);
    setFormOpen(true);
  };
  const beginEdit = () => {
    if (!selectedItem) return;
    // The drawer can close, but I still need this ID when the form saves.
    setEditingId(selectedItem.id);
    setFormState({
      name: selectedItem.name,
      category: selectedItem.category,
      type: selectedItem.type,
      color: selectedItem.color,
      brand: selectedItem.brand ?? '',
      size: selectedItem.size ?? '',
      imageUrl: selectedItem.imageUrl ?? '',
      description: selectedItem.description ?? '',
    });
    setFormError(null);
    setSelectedItem(null);
    setFormOpen(true);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving || imageBusy) return;
    setSaving(true);
    setFormError(null);
    try {
      if (editingId) await updateClothingItem(editingId, formState);
      else await createClothingItem(formState);
      setNotice(editingId ? 'Piece updated.' : 'Piece added to your wardrobe.');
      setFormOpen(false);
      setEditingId(null);
      refresh();
    } catch (error) {
      setFormError(message(error));
    } finally {
      setSaving(false);
    }
  };

  const saveOutfit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (savingOutfit) return;
    setSavingOutfit(true);
    setOutfitError(null);
    try {
      const saved = await createOutfit({
        name: outfitName,
        description: outfitDescription,
        topClothingItemId: outfitTop,
        bottomClothingItemId: outfitBottom,
      });
      setOutfits((current) => [saved, ...current]);
      setOutfitName('');
      setOutfitDescription('');
      setNotice('Outfit saved.');
    } catch (error) {
      setOutfitError(message(error));
    } finally {
      setSavingOutfit(false);
    }
  };

  const askDelete = (id: string, kind: 'clothing' | 'outfit') => {
    setSelectedItem(null);
    setDeleteError(null);
    setPendingDelete({ id, kind });
  };
  const confirmDelete = async () => {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      if (pendingDelete.kind === 'clothing') {
        await deleteClothingItem(pendingDelete.id);
        if (outfitTop === pendingDelete.id) setOutfitTop('');
        if (outfitBottom === pendingDelete.id) setOutfitBottom('');
      } else await deleteOutfit(pendingDelete.id);
      setPendingDelete(null);
      setNotice(
        pendingDelete.kind === 'clothing'
          ? 'Piece and its saved outfits deleted.'
          : 'Outfit deleted.',
      );
      refresh();
    } catch (error) {
      setDeleteError(message(error));
    } finally {
      setDeleting(false);
    }
  };

  const navigateTo = (section: string) => {
    setActiveSection(section);
    document.getElementById(section)?.scrollIntoView({
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
    });
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <button
          type="button"
          className="brand-lockup"
          onClick={() => navigateTo('dashboard')}
        >
          <span className="brand-mark">O</span>
          <span>
            <strong>Outfit Picker</strong>
            <small>Make more of your wardrobe</small>
          </span>
        </button>
        <nav className="nav" aria-label="Primary navigation">
          {[
            ['dashboard', 'Overview'],
            ['wardrobe', 'My closet'],
            ['outfits', 'Outfit builder'],
          ].map(([id, label]) => (
            <button
              type="button"
              key={id}
              aria-current={activeSection === id ? 'location' : undefined}
              className={activeSection === id ? 'active' : ''}
              onClick={() => navigateTo(id)}
            >
              {label}
            </button>
          ))}
        </nav>
        <button type="button" className="topbar-action" onClick={addClothing}>
          + Add clothing
        </button>
      </header>
      <main className="page-shell">
        {collectionError && (
          <div className="status-error" role="alert">
            {collectionError}{' '}
            <button className="secondary-button" onClick={refresh}>
              Try again
            </button>
          </div>
        )}
        {notice && (
          <div className="status-success" role="status">
            {notice}
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => setNotice('')}
            >
              ×
            </button>
          </div>
        )}
        <section id="dashboard" className="welcome-strip">
          <div>
            <p className="eyebrow">Less guessing. More getting dressed.</p>
            <h1>Dress with intention.</h1>
            <p className="welcome-copy">
              Your clothes, all in one place. Rediscover what you own and put
              something good together.
            </p>
          </div>
          <div className="summary-row">
            <div>
              <strong>{stats.total}</strong>
              <span>All pieces</span>
            </div>
            <div>
              <strong>{stats.tops}</strong>
              <span>Tops</span>
            </div>
            <div>
              <strong>{stats.bottoms}</strong>
              <span>Bottoms</span>
            </div>
          </div>
        </section>
        <section id="wardrobe" className="wardrobe-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">The collection</p>
              <h2>
                My closet <span>{stats.total}</span>
              </h2>
            </div>
            <button
              type="button"
              className="primary-button"
              onClick={addClothing}
            >
              + Add clothing
            </button>
          </div>
          <div className="toolbar">
            <label className="search-field">
              Search
              <input
                type="search"
                aria-label="Search wardrobe"
                value={search}
                maxLength={120}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Name, type, color, brand or size"
              />
            </label>
            <label>
              Category
              <select
                value={category}
                onChange={(event) => {
                  setCategory(event.target.value as typeof category);
                  setType('ALL');
                }}
              >
                <option value="ALL">All pieces</option>
                <option value="TOP">Tops</option>
                <option value="BOTTOM">Bottoms</option>
              </select>
            </label>
            <label>
              Type
              <select
                value={type}
                onChange={(event) => setType(event.target.value as typeof type)}
              >
                <option value="ALL">All types</option>
                {(category === 'ALL'
                  ? [...typeOptions.TOP, ...typeOptions.BOTTOM]
                  : typeOptions[category]
                ).map((value) => (
                  <option key={value} value={value}>
                    {formatType(value)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Color
              <select
                value={color}
                onChange={(event) =>
                  setColor(event.target.value as typeof color)
                }
              >
                <option value="ALL">All colors</option>
                {colorOptions.map((value) => (
                  <option key={value} value={value}>
                    {formatType(value)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Sort
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as typeof sort)}
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="name-asc">Name A–Z</option>
                <option value="name-desc">Name Z–A</option>
              </select>
            </label>
            <label>
              Brand
              <input
                value={brand}
                maxLength={80}
                onChange={(event) => setBrand(event.target.value)}
                placeholder="Any brand"
              />
            </label>
            <label>
              Size
              <select
                value={size}
                onChange={(event) => setSize(event.target.value)}
              >
                <option value="">All sizes</option>
                {Array.from(
                  new Set(
                    allItems
                      .map((item) => item.size)
                      .filter((value): value is string => !!value),
                  ),
                )
                  .sort()
                  .map((value) => (
                    <option key={value}>{value}</option>
                  ))}
              </select>
            </label>
          </div>
          <div className="results-line">
            <span>
              {loading
                ? 'Finding your pieces…'
                : `${items.length} ${items.length === 1 ? 'piece' : 'pieces'}${hasFilters ? ' found' : ' in your collection'}`}
            </span>
            {hasFilters && (
              <button
                type="button"
                className="text-button"
                onClick={resetFilters}
              >
                Clear filters
              </button>
            )}
          </div>
          {filterError ? (
            <div className="status-error" role="alert">
              {filterError} <button onClick={refresh}>Try again</button>
            </div>
          ) : loading || collectionLoading ? (
            <div className="loading-state" role="status">
              Loading your wardrobe…
            </div>
          ) : collectionError ? null : !allItems.length ? (
            <EmptyWardrobe onAddClothing={addClothing} />
          ) : !items.length ? (
            <div className="empty-state">
              <h3>No pieces found.</h3>
              <p>Try a different search or clear your filters.</p>
              <button
                type="button"
                className="secondary-button"
                onClick={resetFilters}
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="wardrobe-grid">
              {items.map((item) => (
                <ClothingCard
                  key={item.id}
                  item={item}
                  onSelect={setSelectedItem}
                />
              ))}
            </div>
          )}
        </section>
        <section id="outfits" className="outfits-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">A little outfit planning</p>
              <h2>Better together.</h2>
            </div>
          </div>
          <div className="outfit-layout">
            <OutfitBuilder
              items={allItems}
              name={outfitName}
              description={outfitDescription}
              topId={outfitTop}
              bottomId={outfitBottom}
              busy={savingOutfit}
              loading={collectionLoading}
              error={outfitError}
              onNameChange={setOutfitName}
              onDescriptionChange={setOutfitDescription}
              onTopChange={setOutfitTop}
              onBottomChange={setOutfitBottom}
              onSubmit={saveOutfit}
            />
            <SavedOutfits
              outfits={outfits}
              loading={collectionLoading}
              busy={savingOutfit}
              onUse={(outfit) => {
                setOutfitTop(
                  outfit.items.find((item) => item.role === 'TOP')?.clothingItem
                    .id ?? '',
                );
                setOutfitBottom(
                  outfit.items.find((item) => item.role === 'BOTTOM')
                    ?.clothingItem.id ?? '',
                );
                setOutfitName(`${outfit.name.slice(0, 113)} (copy)`);
                setOutfitDescription(outfit.description ?? '');
                setOutfitError(null);
                navigateTo('outfits');
              }}
              onDelete={(id) => askDelete(id, 'outfit')}
            />
          </div>
        </section>
        <footer className="page-footer">
          Outfit Picker <span>A little more wear out of what you own.</span>
        </footer>
      </main>
      {formOpen && (
        <Dialog
          title={editingId ? 'Edit clothing' : 'Add clothing'}
          busy={saving || imageBusy}
          onClose={closeForm}
        >
          <ClothingForm
            values={formState}
            editing={!!editingId}
            error={formError}
            busy={saving}
            onBusyChange={setImageBusy}
            onChange={setFormState}
            onSubmit={handleSubmit}
            onCancel={closeForm}
          />
        </Dialog>
      )}
      {selectedItem && (
        <Dialog
          title={selectedItem.name}
          drawer
          onClose={() => setSelectedItem(null)}
        >
          <ClothingDetail
            item={selectedItem}
            busy={deleting}
            onEdit={beginEdit}
            onDelete={(id) => askDelete(id, 'clothing')}
          />
        </Dialog>
      )}
      {pendingDelete && (
        <Dialog
          title={
            pendingDelete.kind === 'clothing'
              ? 'Delete this piece?'
              : 'Delete this outfit?'
          }
          busy={deleting}
          onClose={() => setPendingDelete(null)}
        >
          <div className="confirmation-body">
            <p>
              {pendingDelete.kind === 'clothing'
                ? 'This will also delete saved outfits that use this piece. Your other clothing will stay in your closet.'
                : 'This removes the saved combination. Both pieces will stay in your closet.'}
            </p>
            {deleteError && (
              <p className="form-error" role="alert">
                {deleteError}
              </p>
            )}
            <div className="detail-actions">
              <button
                type="button"
                className="danger-button"
                disabled={deleting}
                onClick={() => void confirmDelete()}
              >
                {deleting ? 'Deleting…' : 'Confirm delete'}
              </button>
              <button
                type="button"
                className="secondary-button"
                disabled={deleting}
                onClick={() => setPendingDelete(null)}
              >
                Keep it
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}

export default App;
