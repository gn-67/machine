import { KIND_LABELS, type ContentItem } from "../content/types";
import { openSong } from "../content/spotify";

/**
 * Expanded view for one pulled card, shown in the gap between the card
 * column and the machine. Renders whatever the content model has — image,
 * title, subtitle, the always-present attribution, and a link out. No close
 * button: App.tsx closes this on an outside click or when another card is
 * picked.
 *
 * For songs, `onSwapSong` (when provided — App only wires it up when the
 * current mood has at least one curated pick) renders a second "a pick"
 * button that swaps the displayed song for a random hand-picked one.
 */
export function CardDetail({
  item,
  onSwapSong,
}: {
  item: ContentItem;
  onSwapSong?: () => void;
}) {
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
      <span className="detail-kind">{KIND_LABELS[item.kind]}</span>
      <div className="detail-body" key={item.id}>
        {image ? (
          <img className="detail-image" src={image} alt="" />
        ) : (
          <div className="detail-image placeholder" aria-hidden="true" />
        )}
        <h2 className="detail-title">{item.title}</h2>
        {subtitle && <p className="detail-subtitle">{subtitle}</p>}
        <p className="detail-attribution">{item.attribution}</p>
      </div>
      {(item.url || onSwapSong) && (
        <div className="detail-actions">
          {item.kind === "song" && item.url && (
            <button className="detail-link" onClick={() => openSong(item)}>
              {item.playlistId ? "play in playlist ↗" : "play ↗"}
            </button>
          )}
          {item.kind !== "song" && item.url && (
            <a className="detail-link" href={item.url} target="_blank" rel="noreferrer">
              open ↗
            </a>
          )}
          {item.kind === "song" && onSwapSong && (
            <button className="detail-pick" onClick={onSwapSong}>
              a pick
            </button>
          )}
        </div>
      )}
    </section>
  );
}
