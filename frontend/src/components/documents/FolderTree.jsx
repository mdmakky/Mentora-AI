import { Folder, FolderOpen, ChevronRight, ChevronDown } from 'lucide-react';

const FolderTree = ({ folders, activeFolder, onSelect }) => {
  // Build tree from flat list
  const rootFolders = folders.filter((f) => !f.parent_id);

  const renderFolder = (folder) => {
    const isActive = activeFolder === folder.id;
    const children = folders.filter((f) => f.parent_id === folder.id);

    return (
      <div key={folder.id}>
        <button
          onClick={() => onSelect(isActive ? null : folder.id)}
          className={`folder-tree-item w-full text-left ${isActive ? 'active' : ''}`}
        >
          {isActive ? (
            <FolderOpen size={16} className="text-emerald-600 flex-shrink-0" />
          ) : (
            <Folder size={16} className="flex-shrink-0" />
          )}
          <span className="truncate">{folder.name}</span>
        </button>

        {children.length > 0 && (
          <div className="ml-4 border-l border-slate-100 pl-2">
            {children.map(renderFolder)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-0.5">
      <button
        onClick={() => onSelect(null)}
        className={`folder-tree-item w-full text-left ${!activeFolder ? 'active' : ''}`}
      >
        <Folder size={16} className="flex-shrink-0" />
        <span className="truncate">All Documents</span>
      </button>
      {rootFolders.map(renderFolder)}
    </div>
  );
};

export default FolderTree;
