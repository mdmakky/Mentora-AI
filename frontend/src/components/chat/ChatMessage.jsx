import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CitationBadge from './CitationBadge';

const ChatMessage = ({ message, onCitationClick }) => {
  const isUser = message.role === 'user';

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
                onClick={() => onCitationClick?.(src.page_number)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;
