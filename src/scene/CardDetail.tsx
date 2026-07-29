import type { ContentItem } from "../content/types";
import { songPlayUrl } from "../content/spotify";

/**
 * Expanded view for one pulled card, shown in the gap between the card
 * column and the machine. Renders whatever the content model has — image,
 * title, subtitle, the always-present attribution, and a link out.
 */
export function CardDetail({ item, onClose }: { item: ContentItem; onClose: () => void }) {
  const image = item.kind === "song" ? item.albumArt : item.image;
  const link = item.kind === "song" ? songPlayUrl(item) : item.url;
  const subtitle =
    item.kind === "song"
      ? item.artist
      : item.kind === "artwork"
        ? item.year
          ? `${item.artist} · ${item.year}`
          : item.artist
        : item.description;

  return (
    <section className="card-detail" aria-label={`${item.kind} details`}>
      <button className="detail-close" onClick={onClose} aria-label="Close details">
        ×
      </button>
      <span className="detail-kind">{item.kind}</span>
      {image ? (
        <img className="detail-image" src={image} alt="" />
      ) : (
        <div className="detail-image placeholder" aria-hidden="true" />
      )}
      <h2 className="detail-title">{item.title}</h2>
      {subtitle && <p className="detail-subtitle">{subtitle}</p>}
      <p className="detail-attribution">{item.attribution}</p>
      {link && (
        <a className="detail-link" href={link} target="_blank" rel="noreferrer">
          open ↗
        </a>
      )}
    </section>
  );
}
