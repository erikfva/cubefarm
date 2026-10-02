import { describe, expect, it } from 'vitest';
import { messagesUrl, replyText } from './check-gateway.mjs';

describe('messagesUrl', () => {
  it('appends /v1/messages to a bare host', () => {
    expect(messagesUrl('http://vps:3456')).toBe('http://vps:3456/v1/messages');
    expect(messagesUrl('http://vps:3456/')).toBe('http://vps:3456/v1/messages');
  });

  it('keeps fuller base URLs, completing what is missing', () => {
    expect(messagesUrl('http://vps:3456/v1')).toBe('http://vps:3456/v1/messages');
    expect(messagesUrl('http://vps:3456/v1/messages')).toBe('http://vps:3456/v1/messages');
  });
});

describe('replyText', () => {
  it('joins the text blocks of a Messages reply', () => {
    expect(replyText({ content: [{ type: 'text', text: 'ok' }] })).toBe('ok');
    expect(replyText({ content: [{ type: 'text', text: 'a' }, { type: 'tool_use', id: '1' }, { type: 'text', text: 'b' }] })).toBe('a\nb');
  });

  it('is empty for anything without text', () => {
    expect(replyText(null)).toBe('');
    expect(replyText({})).toBe('');
    expect(replyText({ content: [{ type: 'tool_use' }] })).toBe('');
  });
});
