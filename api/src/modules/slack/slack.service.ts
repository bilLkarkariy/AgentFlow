import { Injectable, NotFoundException } from '@nestjs/common';
import { WebClient } from '@slack/web-api';

@Injectable()
export class SlackService {
  private readonly client: WebClient;

  constructor() {
    this.client = new WebClient(process.env.SLACK_BOT_TOKEN);
  }

  /**
   * Resolve a channel name (#name) or ID to its channel ID
   */
  private async getChannelId(channel: string): Promise<string> {
    // If already an ID, return as is
    if (/^[CGD]/.test(channel)) {
      return channel;
    }
    const name = channel.replace(/^#/, '');
    const list = await this.client.conversations.list({ exclude_archived: true, types: 'public_channel,private_channel' });
    const found = list.channels?.find((c: any) => c.name === name);
    if (!found) {
      throw new NotFoundException(`Channel not found: ${channel}`);
    }
    return found.id;
  }

  /**
   * Post a message to a Slack channel or user
   */
  async postMessage(channel: string, text: string): Promise<any> {
    const id = await this.getChannelId(channel);
    const res = await this.client.chat.postMessage({ channel: id, text });
    return res;
  }

  /**
   * Fetch messages from a Slack channel
   */
  async getMessages(channel: string, limit = 10): Promise<any[]> {
    const id = await this.getChannelId(channel);
    const res = await this.client.conversations.history({ channel: id, limit });
    return res.messages;
  }
}
