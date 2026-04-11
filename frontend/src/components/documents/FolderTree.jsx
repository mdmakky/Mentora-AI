import { useState } from 'react';
import { Folder, FolderOpen, MoreVertical, Pencil, Trash2, Check, X } from 'lucide-react';
import useDocumentStore from '../../stores/documentStore';
import ConfirmDialog from '../ui/ConfirmDialog';

const FolderTree = ({ folders, activeFolder, onSelect, courseId }) => {
  const { deleteFolder, renameFolder } = useDocumentStore();
  const [menuOpen, setMenuOpen] = useState(null);   // folder.id
  const [renaming, setRenaming] = useState(null);   // folder.id
  const [renameVal, setRenameVal] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null); // folder object

  const rootFolders = folders.filter((f) => !f.parent_id);

  const handleRenameStart = (folder) => {
    setMenuOpen(null);
    setRenaming(folder.id);
    setRenameVal(folder.name);
  };

  const handleRenameSubmit = async (folderId) => {
    if (renameVal.trim()) {
      await renameFolder(folderId, renameVal.trim());
    }
    setRenaming(null);
    setRenameVal('');
  };

  const handleDeleteConfirm = async () => {
    if (confirmDelete) {
      await deleteFolder(confirmDelete.id);
      if (activeFolder === confirmDelete.id) onSelect(null);
    }
  };

  const renderFolder = (folder) => {
    const isActive = activeFolder === folder.id;
    const children = folders.filter((f) => f.parent_id === folder.id);
    const isRenaming = renaming === folder.id;
    const isMenuOpen = menuOpen === folder.id;

    return (
      <div key={folder.id}>
        <div className={`folder-tree-item group w-full ${isActive ? 'active' : ''}`}>
          {/* Folder icon */}
          <button
            onClick={() => { if (!isRenaming) onSelect(isActive ? null : folder.id); }}
            className="flex items-center gap-2 flex-1 min-w-0 text-left"
          >
            {isActive ? (
              <FolderOpen size={16} className="text-emerald-600 flex-shrink-0" />
            ) : (
              <Folder size={16} className="flex-shrink-0" />
            )}

            {isRenaming ? (
              <input
                autoFocus
                value={renameVal}
                onChange={(e) => setRenameVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameSubmit(folder.id);
                  if (e.key === 'Escape') setRenaming(null);
                }}
                onClick={(e) => e.stopPropagation()}
                className="flex-1 min-w-0 text-sm bg-white border border-emerald-400 rounded px-1.5 py-0.5 outline-none focus:ring-2 focus:ring-emerald-100"
              />
            ) : (
              <span className="truncate text-sm">{folder.name}</span>
            )}
          </button>

          {/* Rename save/cancel buttons */}
          {isRenaming ? (
            <div className="flex items-center gap-0.5 flex-shrink-0 ml-1">
              <button
                onClick={() => handleRenameSubmit(folder.id)}
                className="w-5 h-5 flex items-center justify-center rounded text-emerald-600 hover:bg-emerald-50"
              >
                <Check size={12} />
              </button>
              <button
                onClick={() => setRenaming(null)}
                className="w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:bg-slate-100"
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            /* More menu */
            <div className="relative flex-shrink-0">
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(isMenuOpen ? null : folder.id); }}
                className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <MoreVertical size={13} />
              </button>

              {isMenuOpen && (
                <div className="absolute right-0 top-7 z-20 bg-white rounded-xl shadow-lg border border-slate-100 py-1 min-w-[120px]">
                  <button
                    onClick={() => handleRenameStart(folder)}
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    <Pencil size={12} /> Rename
                  </button>
                  <button
                    onClick={() => { setMenuOpen(null); setConfirmDelete(folder); }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {children.length > 0 && (
          <div className="ml-4 border-l border-slate-100 pl-2">
            {children.map(renderFolder)}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="space-y-0.5" onClick={() => setMenuOpen(null)}>
        <button
          onClick={() => onSelect(null)}
          className={`folder-tree-item w-full text-left ${!activeFolder ? 'active' : ''}`}
        >
          <Folder size={16} className="flex-shrink-0" />
          <span className="truncate text-sm">All Documents</span>
        </button>
        {rootFolders.map(renderFolder)}
      </div>

      <ConfirmDialog
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Folder?"
        message={`"${confirmDelete?.name}" and all its contents will be permanently deleted.`}
        confirmLabel="Delete Folder"
      />
    </>
  );
};

export default FolderTree;
