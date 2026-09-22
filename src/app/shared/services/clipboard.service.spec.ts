import { ClipboardService } from './clipboard.service';

describe('ClipboardService', () => {
  let service: ClipboardService;
  let writeTextMock: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();

    writeTextMock = jest
      .spyOn(navigator.clipboard, 'writeText')
      .mockResolvedValue();

    service = new ClipboardService();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.restoreAllMocks();
  });

  it('should copy the value to the clipboard', async () => {
    await service.copy('hello');

    expect(writeTextMock).toHaveBeenCalledTimes(1);
    expect(writeTextMock).toHaveBeenCalledWith('hello');
  });

  it('should not create a timer when ttlMs is undefined', async () => {
    await service.copy('hello');

    expect(jest.getTimerCount()).toBe(0);
    expect(writeTextMock).toHaveBeenCalledWith('hello');
  });

  it('should clear the clipboard after ttlMs', async () => {
    await service.copy('hello', 1000);

    expect(writeTextMock).toHaveBeenCalledTimes(1);
    expect(writeTextMock).toHaveBeenNthCalledWith(1, 'hello');

    jest.advanceTimersByTime(999);

    expect(writeTextMock).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(1);

    expect(writeTextMock).toHaveBeenCalledTimes(2);
    expect(writeTextMock).toHaveBeenNthCalledWith(2, '');
  });

  it('should cancel the previous timer when copy is called again', async () => {
    await service.copy('first', 1000);

    jest.advanceTimersByTime(500);

    await service.copy('second', 1000);

    expect(writeTextMock).toHaveBeenCalledTimes(2);

    jest.advanceTimersByTime(500);

    expect(writeTextMock).toHaveBeenCalledTimes(2);

    jest.advanceTimersByTime(500);

    expect(writeTextMock).toHaveBeenCalledTimes(3);
    expect(writeTextMock).toHaveBeenNthCalledWith(3, '');
  });

  it('should cancel the previous timer when copying without ttlMs', async () => {
    await service.copy('first', 1000);

    await service.copy('second');

    expect(jest.getTimerCount()).toBe(0);

    jest.advanceTimersByTime(1000);

    expect(writeTextMock).toHaveBeenCalledTimes(2);
    expect(writeTextMock).toHaveBeenNthCalledWith(1, 'first');
    expect(writeTextMock).toHaveBeenNthCalledWith(2, 'second');
  });

  it('should warn when clearing the clipboard fails', async () => {
    const error = new Error('Clipboard error');

    writeTextMock.mockImplementation(async (value: string) => {
      if (value === '') {
        throw error;
      }
    });

    const warnSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    await service.copy('hello', 1000);

    jest.advanceTimersByTime(1000);

    await Promise.resolve();

    expect(warnSpy).toHaveBeenCalledWith(
      'Clipboard clear failed:',
      error,
    );
  });

  it('should keep only the latest timer when copy is called multiple times', async () => {
    await service.copy('first', 1000);
    await service.copy('second', 2000);
    await service.copy('third', 3000);

    expect(jest.getTimerCount()).toBe(1);

    jest.advanceTimersByTime(2000);

    expect(writeTextMock).toHaveBeenCalledTimes(3);

    jest.advanceTimersByTime(1000);

    expect(writeTextMock).toHaveBeenCalledTimes(4);
    expect(writeTextMock).toHaveBeenNthCalledWith(4, '');
  });
});

Object.defineProperty(navigator, 'clipboard', {
  configurable: true,
  value: {
    writeText: jest.fn().mockResolvedValue(undefined),
  },
});