"""Voice note -> text, via a local Wyoming ASR server (e.g. wyoming-whisper).

The browser records whatever codec MediaRecorder gives it (webm/opus); ffmpeg
transcodes that to raw 16kHz mono PCM16, which is what the Wyoming protocol
streams to the ASR service as a sequence of AudioChunk events.
"""

import asyncio

from wyoming.asr import Transcribe, Transcript
from wyoming.audio import AudioChunk, AudioStart, AudioStop
from wyoming.client import AsyncTcpClient
from wyoming.event import Event

from app.config import settings

SAMPLE_RATE = 16000
SAMPLE_WIDTH = 2  # 16-bit
CHANNELS = 1
CHUNK_BYTES = 4096

FFMPEG_TIMEOUT_SECONDS = 30
WHISPER_TIMEOUT_SECONDS = 60


class SpeechUnavailableError(Exception):
    """ffmpeg or the Wyoming ASR service could not be reached/used."""


async def _transcode_to_pcm16(audio_bytes: bytes) -> bytes:
    try:
        proc = await asyncio.create_subprocess_exec(
            "ffmpeg",
            "-i", "pipe:0",
            "-f", "s16le",
            "-ar", str(SAMPLE_RATE),
            "-ac", str(CHANNELS),
            "-loglevel", "error",
            "pipe:1",
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
    except FileNotFoundError as exc:
        raise SpeechUnavailableError("ffmpeg ist auf dem Server nicht installiert") from exc

    try:
        stdout, stderr = await asyncio.wait_for(
            proc.communicate(input=audio_bytes), timeout=FFMPEG_TIMEOUT_SECONDS
        )
    except asyncio.TimeoutError as exc:
        proc.kill()
        raise SpeechUnavailableError("Audio-Konvertierung (ffmpeg) hat zu lange gebraucht") from exc

    if proc.returncode != 0 or not stdout:
        raise SpeechUnavailableError(f"Audio konnte nicht konvertiert werden: {stderr.decode(errors='ignore')[:200]}")
    return stdout


async def transcribe_audio(audio_bytes: bytes) -> str:
    pcm = await _transcode_to_pcm16(audio_bytes)

    try:
        async with AsyncTcpClient(
            settings.whisper_host, settings.whisper_port, connect_timeout=5.0
        ) as client:
            await client.write_event(Transcribe().event())
            await client.write_event(AudioStart(rate=SAMPLE_RATE, width=SAMPLE_WIDTH, channels=CHANNELS).event())
            for offset in range(0, len(pcm), CHUNK_BYTES):
                chunk = pcm[offset : offset + CHUNK_BYTES]
                await client.write_event(
                    AudioChunk(rate=SAMPLE_RATE, width=SAMPLE_WIDTH, channels=CHANNELS, audio=chunk).event()
                )
            await client.write_event(AudioStop().event())

            while True:
                event: Event | None = await asyncio.wait_for(
                    client.read_event(), timeout=WHISPER_TIMEOUT_SECONDS
                )
                if event is None:
                    raise SpeechUnavailableError("Wyoming-Whisper hat die Verbindung ohne Transkript beendet")
                if Transcript.is_type(event.type):
                    return Transcript.from_event(event).text.strip()
    except (OSError, asyncio.TimeoutError) as exc:
        raise SpeechUnavailableError(
            f"Whisper ({settings.whisper_host}:{settings.whisper_port}) nicht erreichbar"
        ) from exc
