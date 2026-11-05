import { AudioTranscriber, audioExtension } from './audio-transcriber';

const env: Record<string, string> = { OPENAI_API_KEY: 'sk-test' };
const config = { get: (k: string) => env[k] } as any;

describe('audioExtension', () => {
  it('reconoce los formatos de WhatsApp que OpenAI acepta, con o sin codecs', () => {
    expect(audioExtension('audio/ogg; codecs=opus')).toBe('ogg');
    expect(audioExtension('audio/mpeg')).toBe('mp3');
    expect(audioExtension('audio/mp4')).toBe('m4a');
  });
  it('devuelve null para AAC, AMR o desconocidos', () => {
    expect(audioExtension('audio/aac')).toBeNull();
    expect(audioExtension('audio/amr')).toBeNull();
    expect(audioExtension('')).toBeNull();
  });
});

describe('AudioTranscriber', () => {
  afterEach(() => jest.restoreAllMocks());

  it('manda el audio a la API de transcripción con nombre .ogg y devuelve el texto', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async () => new Response('{"text":"  Hola, ¿tienen envíos? "}', { status: 200 }));
    await expect(new AudioTranscriber(config).transcribe(Buffer.from('x'), 'audio/ogg; codecs=opus')).resolves.toBe('Hola, ¿tienen envíos?');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.openai.com/v1/audio/transcriptions');
    expect((init.headers as any).Authorization).toBe('Bearer sk-test');
    const form = init.body as FormData;
    expect((form.get('file') as File).name).toBe('audio.ogg');
    expect(form.get('model')).toBe('gpt-4o-mini-transcribe');
  });

  it('no llama a OpenAI con un formato no admitido', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');
    await expect(new AudioTranscriber(config).transcribe(Buffer.from('x'), 'audio/amr')).rejects.toThrow(/no admitido/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('un error de OpenAI se propaga con su código', async () => {
    jest.spyOn(global, 'fetch').mockImplementation(async () => new Response('{"error":{"message":"quota"}}', { status: 429 }));
    await expect(new AudioTranscriber(config).transcribe(Buffer.from('x'), 'audio/ogg')).rejects.toThrow(/429/);
  });
});
