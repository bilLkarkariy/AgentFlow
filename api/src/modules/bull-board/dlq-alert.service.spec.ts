import { DlqAlertService } from './dlq-alert.service';
import { SlackService } from '../slack/slack.service';

describe('DlqAlertService', () => {
  let service: DlqAlertService;
  let slackService: SlackService;

  beforeEach(() => {
    slackService = { postMessage: jest.fn() } as any;
    process.env.DLQ_ALERT_THRESHOLD = '5';
    process.env.SLACK_ALERT_CHANNEL = '#test';
    service = new DlqAlertService(slackService);
    // override queue with mock
    (service as any).queue = { getFailedCount: jest.fn() };
  });

  it('sends an alert when failedCount exceeds threshold', async () => {
    (service as any).queue.getFailedCount.mockResolvedValue(6);
    await service.handleDlqAlert();
    expect(slackService.postMessage).toHaveBeenCalledWith(
      '#test',
      expect.stringContaining('6 messages'),
    );
  });

  it('does not send alert again if already sent', async () => {
    (service as any).queue.getFailedCount.mockResolvedValue(6);
    await service.handleDlqAlert();
    (slackService.postMessage as jest.Mock).mockClear();
    await service.handleDlqAlert();
    expect(slackService.postMessage).not.toHaveBeenCalled();
  });

  it('resets alertSent when count falls below threshold', async () => {
    (service as any).queue.getFailedCount
      .mockResolvedValueOnce(6)
      .mockResolvedValueOnce(4);
    // first: send
    await service.handleDlqAlert();
    expect(slackService.postMessage).toHaveBeenCalled();
    // second: below threshold resets state
    await service.handleDlqAlert();
    // third: above threshold again should send again
    (slackService.postMessage as jest.Mock).mockClear();
    (service as any).queue.getFailedCount.mockResolvedValueOnce(6);
    await service.handleDlqAlert();
    expect(slackService.postMessage).toHaveBeenCalled();
  });
});
