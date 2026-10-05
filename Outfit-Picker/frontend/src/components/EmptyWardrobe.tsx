interface EmptyWardrobeProps {
  onAddClothing: () => void;
}

export function EmptyWardrobe({ onAddClothing }: EmptyWardrobeProps) {
  return (
    <section className="empty-wardrobe" aria-labelledby="empty-wardrobe-title">
      <div className="empty-wardrobe-mark" aria-hidden="true">
        +
      </div>
      <p className="eyebrow">Your wardrobe is ready</p>
      <h3 id="empty-wardrobe-title">Nothing here yet.</h3>
      <p>
        Add your first top or bottom to start building a wardrobe that feels
        like yours.
      </p>
      <button type="button" className="primary-button" onClick={onAddClothing}>
        Add Clothing
      </button>
    </section>
  );
}
