import { SlackService } from './slack.service';
import { WebClient } from '@slack/web-api';

jest.mock('@slack/web-api');
const WebClientMock = WebClient as jest.MockedClass<typeof WebClient>;

describe('SlackService', () => {
  let service: SlackService;
  let chatMock: { postMessage: jest.Mock };

  beforeEach(() => {
    chatMock = { postMessage: jest.fn().mockResolvedValue({ ok: true, ts: '12345' }) };
    WebClientMock.mockImplementation(() => ({ chat: chatMock } as any));
    service = new SlackService();
  });

  it('postMessage should call WebClient.chat.postMessage with correct params', async () => {
    const res = await service.postMessage('C123', 'Hello world');
    expect(chatMock.postMessage).toHaveBeenCalledWith({ channel: 'C123', text: 'Hello world' });
    expect(res).toEqual({ ok: true, ts: '12345' });
  });
});
