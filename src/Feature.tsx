import { useState } from "react";
import {
  useEventLog,
  useExpiringClaim,
  useFairRng,
  useFlashOnChange,
  useNamedPeer,
  useReactions,
  type MeshConfig,
  type YRoom,
} from "@baditaflorin/mesh-common";

type Props = { room: YRoom | null; config: MeshConfig };

type Track = {
  id: string;
  peerId: string;
  title: string;
  artist: string;
  url?: string;
  ts: number;
};

const CLAIM_MS = 90_000;
const KINDS = [
  { kind: "fire", glyph: "🔥" },
  { kind: "heart", glyph: "❤️" },
  { kind: "skip", glyph: "⏭️" },
] as const;

export function Feature({ room, config }: Props) {
  if (!room) {
    return (
      <div className="dj-screen">
        <h1>dj deck</h1>
        <p className="dj-status">Connecting…</p>
      </div>
    );
  }
  return <Body room={room} config={config} />;
}

function Body({ room, config }: { room: YRoom; config: MeshConfig }) {
  const { name, setName, nameOf, myName } = useNamedPeer(config, room);
  const claim = useExpiringClaim(room, "dj", CLAIM_MS);
  useFairRng(room, "dj-salts");
  const log = useEventLog<Track>(room, "tracks");
  const reactions = useReactions(room, "track-reactions");

  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [url, setUrl] = useState("");

  const tracks = log.events.slice().reverse();
  const now = tracks[0] ?? null;
  const flash = useFlashOnChange(now?.id ?? "");

  const djName =
    claim.claimedBy && (nameOf(claim.claimedBy) ?? `peer-${claim.claimedBy.slice(0, 6)}`);
  const seconds = Math.ceil(claim.msRemaining / 1000);

  const trimmedName = name.trim();
  const canDrop = claim.isMine && title.trim() && artist.trim();

  const drop = () => {
    if (!canDrop) return;
    const t: Track = {
      id: Math.random().toString(36).slice(2, 12),
      peerId: room.peerId,
      title: title.trim(),
      artist: artist.trim(),
      url: url.trim() || undefined,
      ts: Date.now(),
    };
    log.push(t);
    claim.refresh();
    setTitle("");
    setArtist("");
    setUrl("");
  };

  return (
    <div className="dj-screen">
      <header className="dj-header">
        <h1>dj deck</h1>
        <p className="dj-status">
          {claim.claimedBy ? `${djName} is spinning` : "deck is open"} · {log.size} tracks
        </p>
      </header>

      <div className="dj-name">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="your name"
          maxLength={48}
          aria-label="your name"
        />
      </div>

      <div className="dj-controls">
        <button
          type="button"
          className="dj-take"
          aria-label="take the deck"
          onClick={claim.claim}
          disabled={!trimmedName || (!claim.isFree && !claim.isMine)}
        >
          take the deck
        </button>
        {claim.isMine && (
          <button
            type="button"
            className="dj-release"
            aria-label="release deck"
            onClick={claim.release}
          >
            release deck
          </button>
        )}
        {claim.claimedBy && (
          <span className="dj-chip">
            {djName} · {seconds}s
          </span>
        )}
      </div>

      {claim.isMine && (
        <div className="dj-form">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="title"
            aria-label="title"
          />
          <input
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            placeholder="artist"
            aria-label="artist"
          />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="url (optional)"
            aria-label="url"
          />
          <button
            type="button"
            className="dj-drop"
            aria-label="drop track"
            onClick={drop}
            disabled={!canDrop}
          >
            drop track
          </button>
        </div>
      )}

      {now && (
        <div className={`dj-now${flash ? " dj-flash" : ""}`}>
          <div className="dj-now-meta">
            now playing · {nameOf(now.peerId) ?? (now.peerId === room.peerId ? myName : "peer")}
          </div>
          <div className="dj-now-title">{now.title}</div>
          <div className="dj-now-artist">{now.artist}</div>
          <div className="dj-react" role="group" aria-label="react">
            {KINDS.map(({ kind, glyph }) => (
              <button
                key={kind}
                type="button"
                className="dj-react-btn"
                aria-label={`react ${kind}`}
                onClick={() => reactions.toggle(now.id, kind)}
              >
                {glyph} {reactions.countsFor(now.id)[kind] ?? 0}
              </button>
            ))}
          </div>
        </div>
      )}

      <ul className="dj-feed">
        {tracks.slice(1, 11).map((t) => {
          const c = reactions.countsFor(t.id);
          return (
            <li key={t.id} className="dj-feed-row">
              <span className="dj-feed-title">{t.title}</span>
              <span className="dj-feed-artist"> — {t.artist}</span>
              <span className="dj-feed-tally">
                {KINDS.map((k) => `${k.glyph}${c[k.kind] ?? 0}`).join(" ")}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
