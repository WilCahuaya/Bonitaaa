"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { COVER_IDS, PAIR_IDS, PHOTOS, photoById } from "@/lib/photos";
import { GREETING_ID } from "@/lib/greeting";
import { toWavBlob } from "@/lib/wav";
import { MatrixRain } from "@/components/matrix-rain";

const TARGET = new Date("2026-10-19T00:00:00-05:00").getTime();
const INTRO = ["3", "2", "1", "Feliz cumpleaños", "Anitaaa"];
const SCENES = ["intro", "cat", "gate", "cover", "letter", "pair", "memories", "heart", "close"] as const;
const KEY_NAME = "anita-edit-key";

type Scene = (typeof SCENES)[number];
type Content = { letter: string; audios: string[] };
type Clock = { done: boolean; days: number; hours: number; minutes: number; seconds: number };

const STAR_DOTS = Array.from({ length: 36 }, (_, index) => ({
  left: `${(index * 37) % 100}%`,
  top: `${(index * 53) % 100}%`,
  delay: `${(index % 7) * 0.35}s`,
  size: index % 4 === 0 ? 3 : 2,
}));

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function useCountdown() {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, []);

  if (now === null) return null;
  const diff = Math.max(0, TARGET - now);
  const total = Math.floor(diff / 1000);
  const clock: Clock = {
    done: diff <= 0,
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
  return clock;
}

function heartPoint(index: number, total: number) {
  const t = (Math.PI * 2 * index) / total;
  const x = 16 * Math.sin(t) ** 3;
  const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
  return {
    left: 50 + (x / 16) * 36,
    top: 48 - (y / 17) * 36,
    rotate: (index % 2 === 0 ? -1 : 1) * ((index * 7) % 10),
  };
}

export function Experience() {
  const clock = useCountdown();
  const [scene, setScene] = useState<Scene>("intro");
  const [introStep, setIntroStep] = useState(0);
  const [content, setContent] = useState<Content>({ letter: "", audios: [] });
  const [draft, setDraft] = useState("");
  const [key, setKey] = useState("");
  const [askKey, setAskKey] = useState(false);
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [audioStamp, setAudioStamp] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const editing = key.length > 0;
  const canOpen = Boolean(clock?.done || editing);

  useEffect(() => {
    const saved = window.sessionStorage.getItem(KEY_NAME) ?? "";
    if (saved) setKey(saved);
    void fetch("/api/content")
      .then((response) => response.json())
      .then((data: Content) => {
        setContent(data);
        setDraft(data.letter ?? "");
      })
      .catch(() => setNotice("No pude cargar la carta."));
  }, []);

  useEffect(() => {
    if (scene !== "intro") return;
    if (introStep >= INTRO.length) {
      const timer = window.setTimeout(() => setScene("cat"), 500);
      return () => window.clearTimeout(timer);
    }
    const delay = introStep >= 3 ? 1200 : 850;
    const timer = window.setTimeout(() => setIntroStep((step) => step + 1), delay);
    return () => window.clearTimeout(timer);
  }, [scene, introStep]);

  useEffect(() => {
    return () => {
      recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const heartPhotos = useMemo(
    () =>
      PHOTOS.map((photo, index) => ({
        ...photo,
        ...heartPoint(index, PHOTOS.length),
      })),
    [],
  );

  function go(next: Scene) {
    if (recording) stopRecording();
    setNotice("");
    setScene(next);
    if (next === "intro") setIntroStep(0);
  }

  function forward() {
    const index = SCENES.indexOf(scene);
    const next = SCENES[index + 1];
    if (!next) return;
    if (scene === "gate" && !canOpen) return;
    go(next);
  }

  function back() {
    const index = SCENES.indexOf(scene);
    const previous = SCENES[index - 1];
    if (previous) go(previous);
  }

  async function unlock(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!response.ok) {
      setNotice("Esa no es la clave.");
      return;
    }
    window.sessionStorage.setItem(KEY_NAME, password);
    setKey(password);
    setAskKey(false);
    setPassword("");
    setNotice("Ya puedes escribir y grabar. Ella solo verá el resultado.");
  }

  async function saveLetter() {
    const response = await fetch("/api/content", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-edit-key": key },
      body: JSON.stringify({ letter: draft }),
    });
    if (response.status === 401) {
      setNotice("La clave no coincide. Vuelve a entrar y guarda otra vez.");
      return;
    }
    if (!response.ok) {
      setNotice("No se guardó la carta.");
      return;
    }
    setContent((current) => ({ ...current, letter: draft }));
    setNotice("Carta guardada.");
  }

  async function uploadAudio(id: string, file: Blob) {
    let payload = file;
    try {
      payload = await toWavBlob(file);
    } catch {
      payload = file;
    }
    const body = new FormData();
    body.append("file", payload, payload.type === "audio/wav" ? "audio.wav" : "audio");
    const response = await fetch(`/api/audio/${id}`, {
      method: "POST",
      headers: { "x-edit-key": key },
      body,
    });
    if (!response.ok) {
      setNotice("No se guardó el audio.");
      return;
    }
    setContent((current) => ({
      ...current,
      audios: current.audios.includes(id) ? current.audios : [...current.audios, id],
    }));
    setAudioStamp((stamp) => stamp + 1);
    setNotice("Audio guardado.");
  }

  async function startRecording(id: string) {
    if (!navigator.mediaDevices?.getUserMedia) {
      setNotice("Este navegador no puede grabar. Sube un audio.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"].find((type) =>
        MediaRecorder.isTypeSupported(type),
      );
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        void uploadAudio(id, blob);
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      setNotice("Grabando…");
    } catch {
      setNotice("No pude usar el micrófono. Graba en esta computadora o sube un audio.");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  }

  function closePhoto() {
    if (recording) stopRecording();
    setOpenId(null);
  }

  const openPhoto = openId ? photoById(openId) : undefined;
  const hasAudio = openId ? content.audios.includes(openId) : false;
  const hasGreeting = content.audios.includes(GREETING_ID);

  return (
    <main className="sky" data-scene={scene}>
      {scene === "intro" ? <MatrixRain active /> : <Stars />}
      {scene !== "intro" && <FloatingHearts />}

      {scene === "intro" && (
        <section className="scene">
          <p
            className={`intro-word${(INTRO[Math.min(introStep, INTRO.length - 1)] ?? "").length > 8 ? " long" : ""}`}
          >
            {INTRO[Math.min(introStep, INTRO.length - 1)]}
          </p>
          <button className="ghost" type="button" onClick={() => go("cat")}>
            Saltar
          </button>
        </section>
      )}

      {scene === "cat" && (
        <section className="scene">
          <p className="candles">FELIZ CUMPLEAÑOS</p>
          <img className="portrait" src="/photos/anita.jpg" alt="Anitaaa" />
          {hasGreeting && (
            <audio className="greeting-audio" controls src={`/api/audio/${GREETING_ID}?v=${audioStamp}`} />
          )}
          {editing && (
            <div className="row">
              {recording ? (
                <button className="pill" type="button" onClick={stopRecording}>
                  Detener y guardar
                </button>
              ) : (
                <button className="pill" type="button" onClick={() => void startRecording(GREETING_ID)}>
                  Grabar saludo
                </button>
              )}
              <label className="tiny">
                Subir audio
                <input
                  type="file"
                  accept="audio/*"
                  hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) void uploadAudio(GREETING_ID, file);
                  }}
                />
              </label>
            </div>
          )}
          <button className="pill" type="button" onClick={forward}>
            Seguir
          </button>
        </section>
      )}

      {scene === "gate" && (
        <section className="scene">
          <p className="eyebrow">Contando los días</p>
          <h1>
            Tu día especial
            <span className="script"> se acerca</span>
          </h1>
          <p className="whisper">Anitaaa, cumples 22</p>
          <div className="clock" aria-live="polite">
            <Tick label="Días" value={clock ? pad(clock.days) : "--"} />
            <Tick label="Horas" value={clock ? pad(clock.hours) : "--"} />
            <Tick label="Min" value={clock ? pad(clock.minutes) : "--"} />
            <Tick label="Seg" value={clock ? pad(clock.seconds) : "--"} />
          </div>
          {clock?.done && <p className="whisper">Hoy es tu día especial.</p>}
          {canOpen ? (
            <button className="pill" type="button" onClick={forward}>
              Abrir el regalo
            </button>
          ) : (
            <p className="hint">Se abre a la medianoche.</p>
          )}
          {editing && !clock?.done && (
            <p className="hint">Ella verá este botón a la medianoche. Tú ya puedes preparar todo.</p>
          )}
        </section>
      )}

      {scene === "cover" && (
        <section className="scene">
          <div className="cover">
            {COVER_IDS.map((id) => {
              const photo = photoById(id);
              if (!photo) return null;
              return (
                <div className="float" key={id}>
                  <div className="polaroid">
                    <img src={photo.src} alt="" />
                  </div>
                </div>
              );
            })}
            <div className="cover-copy">
              <p className="eyebrow">Una carta para ti</p>
              <h1>Tu día especial</h1>
              <span className="script">Hecho con amor, solo para ti</span>
              <div className="row">
                <button className="pill" type="button" onClick={forward}>
                  Leer mi carta
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {scene === "letter" && (
        <section className="scene">
          <article className="card">
            <h2>Feliz cumpleaños</h2>
            {editing ? (
              <>
                <textarea
                  value={draft}
                  maxLength={5000}
                  placeholder="Escribe aquí la carta. Ella solo va a leerla."
                  onChange={(event) => setDraft(event.target.value)}
                />
                <div className="row">
                  <button className="pill" type="button" onClick={() => void saveLetter()}>
                    Guardar carta
                  </button>
                </div>
              </>
            ) : (
              <p className="letter">
                {content.letter.trim() || "Willl todavía está escribiendo esta carta."}
              </p>
            )}
          </article>
        </section>
      )}

      {scene === "pair" && (
        <section className="scene">
          <article className="wish-card">
            <p className="script" style={{ fontSize: "clamp(32px, 6vw, 48px)", margin: 0 }}>
              Feliz cumpleaños, Anitaaa
            </p>
            <div className="pair">
              {PAIR_IDS.map((id) => {
                const photo = photoById(id);
                if (!photo) return null;
                return <img key={id} src={photo.src} alt="Recuerdo" />;
              })}
            </div>
          </article>
        </section>
      )}

      {scene === "memories" && (
        <section className="scene scroll">
          <p className="eyebrow">Cada momento, con su voz</p>
          <h2>Nuestros recuerdos</h2>
          <div className="grid">
            {PHOTOS.map((photo) => {
              const ready = content.audios.includes(photo.id);
              return (
                <button key={photo.id} className="shot" type="button" onClick={() => setOpenId(photo.id)}>
                  <div className="polaroid">
                    <img src={photo.src} alt="Recuerdo" />
                    {(ready || editing) && (
                      <span className="badge">{ready ? "Escuchar" : "Grabar"}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {scene === "heart" && (
        <section className="scene">
          <p className="script" style={{ fontSize: "clamp(36px, 7vw, 56px)" }}>
            Anitaaa
          </p>
          <div className="heart-stage">
            {heartPhotos.map((photo) => (
              <img
                key={photo.id}
                className="heart-photo"
                src={photo.src}
                alt=""
                style={{
                  left: `${photo.left}%`,
                  top: `${photo.top}%`,
                  transform: `translate(-50%, -50%) rotate(${photo.rotate}deg)`,
                }}
              />
            ))}
          </div>
        </section>
      )}

      {scene === "close" && (
        <section className="scene">
          <h1>
            Con todo
            <span className="script"> mi amor</span>
          </h1>
          <p className="whisper">Gracias por ser parte de mi vida.</p>
          <p className="whisper">Ojalá este regalo haga tu día todavía más bonito.</p>
          <p className="script" style={{ fontSize: 36 }}>
            Siempre tuyo, Willl
          </p>
          <button className="ghost" type="button" onClick={() => go("intro")}>
            Volver a empezar
          </button>
        </section>
      )}

      <p className="note" style={{ position: "fixed", left: 16, bottom: 64, zIndex: 6 }} aria-live="polite">
        {notice}
      </p>

      {editing ? (
        <div className="banner">
          Estás editando. Ella no ve estos botones.
          <button
            className="tiny"
            type="button"
            style={{ marginLeft: 8 }}
            onClick={() => {
              window.sessionStorage.removeItem(KEY_NAME);
              setKey("");
              setNotice("Así lo ve ella.");
            }}
          >
            Ver como ella
          </button>
        </div>
      ) : (
        <button className="lock" type="button" aria-label="Entrar para escribir" onClick={() => setAskKey(true)}>
          ✎
        </button>
      )}

      {editing && (
        <nav className="dock">
          <button className="tiny" type="button" onClick={back} disabled={scene === "intro"}>
            Atrás
          </button>
          <div className="dots">
            {SCENES.map((item) => (
              <button key={item} type="button" data-on={item === scene} aria-label={item} onClick={() => go(item)} />
            ))}
          </div>
          <button className="tiny" type="button" onClick={forward} disabled={scene === "close" || (scene === "gate" && !canOpen)}>
            Seguir
          </button>
        </nav>
      )}

      {!editing && scene !== "intro" && scene !== "gate" && scene !== "close" && scene !== "cat" && scene !== "cover" && (
        <nav className="dock">
          <button className="tiny" type="button" onClick={back}>
            Atrás
          </button>
          <button className="pill" type="button" onClick={forward}>
            Seguir
          </button>
        </nav>
      )}

      {askKey && (
        <div className="modal">
          <form onSubmit={(event) => void unlock(event)}>
            <p className="eyebrow">Solo Willl</p>
            <h2>Tu clave</h2>
            <input
              type="password"
              value={password}
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
            />
            <div className="row">
              <button className="pill" type="submit">
                Entrar
              </button>
              <button className="ghost" type="button" onClick={() => setAskKey(false)}>
                Cerrar
              </button>
            </div>
          </form>
        </div>
      )}

      {openPhoto && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label="Recuerdo">
          <div className="lightbox-card">
            <img src={openPhoto.src} alt="Recuerdo" />
            {hasAudio && (
              <audio
                key={`${openPhoto.id}-${audioStamp}`}
                controls
                preload="auto"
                src={`/api/audio/${openPhoto.id}?v=${audioStamp}`}
              />
            )}
            {editing && (
              <div className="row">
                {recording ? (
                  <button className="pill" type="button" onClick={stopRecording}>
                    Detener y guardar
                  </button>
                ) : (
                  <button className="pill" type="button" onClick={() => void startRecording(openPhoto.id)}>
                    Grabar
                  </button>
                )}
                <label className="tiny">
                  Subir audio
                  <input
                    type="file"
                    accept="audio/*"
                    hidden
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadAudio(openPhoto.id, file);
                    }}
                  />
                </label>
              </div>
            )}
            {!editing && !hasAudio && <p className="whisper">Este recuerdo todavía no tiene voz.</p>}
            <button className="ghost" type="button" onClick={closePhoto}>
              Cerrar
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function Tick({ label, value }: { label: string; value: string }) {
  return (
    <div className="tick">
      <b>{value}</b>
      <span>{label}</span>
    </div>
  );
}

function Stars() {
  return (
    <div className="stars" aria-hidden>
      {STAR_DOTS.map((dot, index) => (
        <span
          key={index}
          style={{
            left: dot.left,
            top: dot.top,
            width: dot.size,
            height: dot.size,
            animationDelay: dot.delay,
          }}
        />
      ))}
    </div>
  );
}

function FloatingHearts() {
  return (
    <div className="hearts" aria-hidden>
      {STAR_DOTS.slice(0, 10).map((dot, index) => (
        <i key={index} style={{ left: dot.left, top: dot.top, animationDelay: dot.delay }} />
      ))}
    </div>
  );
}
