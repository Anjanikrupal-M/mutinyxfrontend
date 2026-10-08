// ─────────────────────────────────────────────────────────────
// MessageContent
// 
// Renders message content with linkified URLs
// URLs are automatically detected and converted to clickable links
// ─────────────────────────────────────────────────────────────

import React from 'react';

interface MessageContentProps {
    content: string;
}

// Detect URLs in text and return array of text/link segments
function parseContent(text: string): (string | { type: 'link'; url: string; text: string })[] {
    // URL regex pattern - matches http(s):// and www. URLs
    // Also detects URLs without protocol
    const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`\[\]]*|www\.[^\s<>"{}|\\^`\[\]]*|([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}\/[^\s<>"{}|\\^`\[\]]*)/g;
    
    const segments: (string | { type: 'link'; url: string; text: string })[] = [];
    let lastIndex = 0;

    let match;
    const regex = new RegExp(urlRegex);
    
    while ((match = regex.exec(text)) !== null) {
        // Add text before the URL
        if (match.index > lastIndex) {
            segments.push(text.substring(lastIndex, match.index));
        }

        // Detect if URL has protocol
        let detectedUrl = match[0];
        if (!detectedUrl.startsWith('http://') && !detectedUrl.startsWith('https://')) {
            // Add https:// if it looks like a URL but doesn't have a protocol
            if (detectedUrl.includes('.') && !detectedUrl.includes(' ')) {
                detectedUrl = `https://${detectedUrl}`;
            }
        }

        // Add the link
        segments.push({
            type: 'link',
            url: detectedUrl,
            text: match[0],
        });

        lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
        segments.push(text.substring(lastIndex));
    }

    return segments.length > 0 ? segments : [text];
}

export function MessageContent({ content }: MessageContentProps) {
    const segments = parseContent(content);

    return (
        <div className="break-all whitespace-pre-wrap">
            {segments.map((segment, index) => {
                if (typeof segment === 'string') {
                    return <span key={index}>{segment}</span>;
                }
                return (
                    <a
                        key={index}
                        href={segment.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 hover:underline break-all font-medium"
                    >
                        {segment.text}
                    </a>
                );
            })}
        </div>
    );
}

