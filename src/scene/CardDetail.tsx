import type { ContentItem } from "../content/types";
import { openSong } from "../content/spotify";

/**
 * Expanded view for one pulled card, shown in the gap between the card
 * column and the machine. Renders whatever the content model has — image,
 * title, subtitle, the always-present attribution, and a link out. No close
 * button: App.tsx closes this on an outside click or when another card is
 * picked.
 */
export function CardDetail({ item }: { item: ContentItem }) {
  const image = item.kind === "song" ? item.albumArt : item.image;
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
      <span className="detail-kind">{item.kind}</span>
      {image ? (
        <img className="detail-image" src={image} alt="" />
      ) : (
        <div className="detail-image placeholder" aria-hidden="true" />
      )}
      <h2 className="detail-title">{item.title}</h2>
      {subtitle && <p className="detail-subtitle">{subtitle}</p>}
      <p className="detail-attribution">{item.attribution}</p>
      {item.kind === "song" && item.url && (
        <button className="detail-link" onClick={() => openSong(item)}>
          play in playlist ↗
        </button>
      )}
      {item.kind !== "song" && item.url && (
        <a className="detail-link" href={item.url} target="_blank" rel="noreferrer">
          open ↗
        </a>
      )}
    </section>
  );
}
