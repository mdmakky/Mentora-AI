import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CitationBadge from './CitationBadge';

const ChatMessage = ({ message, onCitationClick, onFollowUpClick }) => {
  const isUser = message.role === 'user';
  const followUps = message?.response_meta?.follow_up_questions || [];
  const suggested = message?.response_meta?.suggested_actions || [];
  const followUpItems = [...followUps, ...suggested].filter((item, index, arr) => item && arr.indexOf(item) === index).slice(0, 4);

  return (
    <div className={`chat-msg ${isUser ? 'user' : 'assistant'}`}>
      <div className="chat-msg-avatar">
        {isUser ? '👤' : '✨'}
      </div>
      <div>
        <div className="chat-msg-bubble">
          {isUser ? (
            <p style={{ margin: 0 }}>{message.content}</p>
          ) : (
            <div className="chat-markdown">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Citations */}
        {!isUser && message.source_docs && message.source_docs.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2 ml-1">
            {message.source_docs.map((src, i) => (
              <CitationBadge
                key={i}
                docName={src.doc_name}
                pageNumber={src.page_number}
                excerpt={src.excerpt}
                onClick={() => onCitationClick?.({ pageNumber: src.page_number, excerpt: src.excerpt })}
              />
            ))}
          </div>
        )}

        {!isUser && followUpItems.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2 ml-1">
            {followUpItems.map((item) => (
              <button
                key={item}
                onClick={() => onFollowUpClick?.(item)}
                className="px-2.5 py-1 rounded-full border border-slate-200 bg-white text-[11px] font-medium text-slate-600 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition"
              >
                {item}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;
