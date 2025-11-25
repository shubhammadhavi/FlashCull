import { useState, useEffect, useRef, useMemo } from 'react';
import { 
  X, Check, Trash2, ChevronLeft, ChevronRight, 
  ArrowDownAZ, ArrowUpAZ, ListFilter, Image as ImageIcon, LayoutGrid,
  AlertCircle, Loader2, RotateCcw, ChevronDown
} from 'lucide-react';
import exifr from 'exifr';
import heic2any from 'heic2any';
import { Logo } from './Logo'; // IMPORT THE NEW LOGO

const ALLOWED_EXTENSIONS = [
  'jpg', 'jpeg', 'png', 'webp', 'avif', 
  'heic', 'heif', 
  'arw', 'cr2', 'cr3', 'nef', 'dng', 'raf', 'orf', 'rw2'
];

type FileEntry = {
  name: string;
  handle: FileSystemFileHandle;
  status: 'unreviewed' | 'keep' | 'reject';
};

type SortMode = 'name_asc' | 'name_desc' | 'status';

// --- GLOBAL CACHE ---
const globalImageCache: Record<string, string> = {};
const globalLoadPromises: Record<string, Promise<string | null>> = {};

// --- BRUTE FORCE JPEG FINDER ---
const findLargestJpegInRaw = async (file: File): Promise<Blob | null> => {
  const CHUNK_SIZE = 6 * 1024 * 1024; 
  const buffer = await file.slice(0, CHUNK_SIZE).arrayBuffer();
  const data = new Uint8Array(buffer);
  
  const jpegStarts: number[] = [];
  for (let i = 0; i < data.length - 1; i++) {
    if (data[i] === 0xFF && data[i + 1] === 0xD8) jpegStarts.push(i);
  }

  if (jpegStarts.length === 0) return null;

  let bestBlob: Blob | null = null;
  let maxSize = 0;

  for (const start of jpegStarts) {
    let end = -1;
    for (let j = start + 2; j < data.length - 1; j++) {
      if (data[j] === 0xFF && data[j + 1] === 0xD9) {
        end = j + 2;
        break;
      }
      if (j - start > 5000000) break;
    }

    if (end !== -1) {
      const size = end - start;
      if (size > 50000 && size > maxSize) {
        maxSize = size;
        bestBlob = new Blob([data.slice(start, end)], { type: 'image/jpeg' });
      }
    }
  }
  return bestBlob;
};

// --- IMAGE LOADER ---
const loadImage = async (file: File): Promise<string | null> => {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  
  if (globalImageCache[file.name]) return globalImageCache[file.name];
  if (globalLoadPromises[file.name]) return globalLoadPromises[file.name];

  const loadPromise = (async () => {
    try {
      if (['jpg', 'jpeg', 'png', 'webp', 'avif'].includes(ext)) {
        const url = URL.createObjectURL(file);
        globalImageCache[file.name] = url;
        return url;
      }

      if (['heic', 'heif'].includes(ext)) {
        const convertedBlob = await heic2any({
          blob: file,
          toType: "image/jpeg",
          quality: 0.5 
        });
        const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
        const url = URL.createObjectURL(blob);
        globalImageCache[file.name] = url;
        return url;
      }

      const bruteForceBlob = await findLargestJpegInRaw(file);
      if (bruteForceBlob) {
        const url = URL.createObjectURL(bruteForceBlob);
        globalImageCache[file.name] = url;
        return url;
      }

      let buffer = await exifr.thumbnail(file, { thumbnail: false, preview: true, mergeOutput: false }); 
      if (!buffer) buffer = await exifr.thumbnail(file, { thumbnail: true });
      
      if (buffer) {
        const blob = new Blob([buffer], { type: 'image/jpeg' });
        const url = URL.createObjectURL(blob);
        globalImageCache[file.name] = url;
        return url;
      }
      return null;
    } catch (error) {
      console.error(error);
      return null;
    } finally {
      delete globalLoadPromises[file.name];
    }
  })();

  globalLoadPromises[file.name] = loadPromise;
  return loadPromise;
};

// --- COMPONENT: THUMBNAIL ---
const Thumbnail = ({ fileHandle, status, onClick, isSelected }: any) => {
  const [src, setSrc] = useState<string | null>(globalImageCache[fileHandle.name] || '');

  useEffect(() => {
    if (globalImageCache[fileHandle.name]) {
      setSrc(globalImageCache[fileHandle.name]);
      return;
    }
    let isMounted = true;
    const load = async () => {
      // @ts-ignore
      const file = await fileHandle.getFile();
      const url = await loadImage(file);
      if (isMounted) setSrc(url);
    };
    load();
    return () => { isMounted = false; };
  }, [fileHandle]);

  return (
    <div 
      onClick={onClick} 
      className={`relative group cursor-pointer rounded-lg overflow-hidden transition-all duration-300 border-2 w-full h-full bg-gray-900
        ${isSelected ? 'border-blue-500 ring-4 ring-blue-500/30 z-10' : 'border-transparent'}
        ${status === 'reject' ? 'opacity-40 grayscale-[50%]' : 'opacity-100'}
        ${status === 'keep' ? 'ring-2 ring-green-500/30' : ''}
        hover:shadow-xl hover:scale-[1.02] hover:z-20
      `}
    >
      {src === '' && <div className="w-full h-full flex items-center justify-center text-gray-600"><Loader2 className="animate-spin" size={24} /></div>}
      {src === null && <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 gap-2"><AlertCircle size={24} /><span className="text-[10px]">Error</span></div>}
      {src && <img src={src} alt="" className="w-full h-full object-cover" />}

      {status === 'keep' && <div className="absolute top-2 right-2 bg-green-500 text-black p-1 rounded-full shadow-lg"><Check size={10} strokeWidth={4} /></div>}
      {status === 'reject' && <div className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full shadow-lg"><Trash2 size={10} /></div>}
    </div>
  );
};

// --- COMPONENT: REVIEW MODE ---
const ReviewMode = ({ fileEntry, allFiles, selectedIndex, onClose, onNavigate, onMark }: any) => {
  const [src, setSrc] = useState<string | null>(globalImageCache[fileEntry.name] || '');
  const filmstripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (globalImageCache[fileEntry.name]) {
      setSrc(globalImageCache[fileEntry.name]);
    } else {
      setSrc('');
      const load = async () => {
        // @ts-ignore
        const file = await fileEntry.handle.getFile();
        const url = await loadImage(file);
        setSrc(url);
      };
      load();
    }
  }, [fileEntry]);

  useEffect(() => {
    if (filmstripRef.current) {
      const activeThumb = filmstripRef.current.children[selectedIndex] as HTMLElement;
      if (activeThumb) activeThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [selectedIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') onNavigate(selectedIndex + 1);
      if (e.key === 'ArrowLeft') onNavigate(selectedIndex - 1);
      if (e.key === 'ArrowUp') onMark('keep');
      if (e.key === 'ArrowDown') onMark('reject');
      if (e.key === 'Backspace' || e.key === '0') onMark('unreviewed');
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, onNavigate, onMark, onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-[#0f0f0f] flex flex-col animate-in fade-in duration-200">
      <div className="h-14 flex items-center justify-between px-4 border-b border-gray-800 bg-[#1a1a1a]">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors"><X size={20} /></button>
          <span className="font-mono text-sm text-gray-400 truncate max-w-[200px]">{fileEntry.name}</span>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={() => onMark('unreviewed')}
            title="Reset (Backspace)"
            className="flex items-center gap-2 px-3 py-1.5 rounded bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white transition-colors text-xs font-bold uppercase tracking-wider"
          >
            <RotateCcw size={14} /> Reset
          </button>

          <div className={`px-3 py-1.5 rounded text-xs font-bold tracking-wider transition-colors border ${
            fileEntry.status === 'keep' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 
            fileEntry.status === 'reject' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-gray-800 text-gray-500 border-transparent'
          }`}>
            {fileEntry.status === 'unreviewed' ? 'UNREVIEWED' : fileEntry.status.toUpperCase()}
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center overflow-hidden p-2 relative group">
        <button onClick={() => onNavigate(selectedIndex - 1)} className="absolute left-4 p-3 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 hover:bg-black/80 transition-all z-10"><ChevronLeft /></button>
        <button onClick={() => onNavigate(selectedIndex + 1)} className="absolute right-4 p-3 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 hover:bg-black/80 transition-all z-10"><ChevronRight /></button>
        
        {src === '' ? (
          <div className="flex flex-col items-center gap-2 text-gray-500">
            <Loader2 className="animate-spin" size={32} />
            <span className="text-sm font-mono">Loading...</span>
          </div>
        ) : src === null ? (
           <div className="flex flex-col items-center text-gray-500 gap-4"><AlertCircle size={48} /><span>Preview Unavailable</span></div>
        ) : (
          <img src={src} className={`max-h-full max-w-full object-contain shadow-2xl transition-all duration-200 ${
            fileEntry.status === 'keep' ? 'ring-4 ring-green-500/50' : 
            fileEntry.status === 'reject' ? 'opacity-50 grayscale' : ''
          }`} />
        )}
      </div>

      <div className="h-24 bg-[#1a1a1a] border-t border-gray-800 flex items-center px-2">
        <div ref={filmstripRef} className="flex gap-2 overflow-x-auto w-full h-20 items-center px-2 scrollbar-hide">
          {allFiles.map((file: FileEntry, idx: number) => (
            <div key={file.name} className="h-16 w-16 min-w-[4rem]">
              <Thumbnail fileHandle={file.handle} status={file.status} isSelected={idx === selectedIndex} onClick={() => onNavigate(idx)} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// --- MAIN APP ---
function App() {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [rootHandle, setRootHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'processing'>('idle');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('name_asc');
  const [columnCount, setColumnCount] = useState<number>(6);
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);

  useEffect(() => {
    const closeMenu = () => setIsSortMenuOpen(false);
    if (isSortMenuOpen) window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, [isSortMenuOpen]);

  const handleOpenFolder = async () => {
    try {
      // @ts-ignore
      const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
      setRootHandle(dirHandle);
      setStatus('loading');
      const foundFiles: FileEntry[] = [];
      // @ts-ignore
      for await (const entry of dirHandle.values()) {
        const ext = entry.name.split('.').pop()?.toLowerCase() || '';
        if (entry.kind === 'file' && ALLOWED_EXTENSIONS.includes(ext)) {
          // @ts-ignore
          foundFiles.push({ name: entry.name, handle: entry, status: 'unreviewed' });
        }
      }
      setFiles(foundFiles);
      setStatus('ready');
    } catch (err) { console.error(err); setStatus('idle'); }
  };

  const updateStatus = (index: number, newStatus: 'keep' | 'reject' | 'unreviewed') => {
    setFiles(prev => {
      const copy = [...prev];
      copy[index].status = newStatus;
      return copy;
    });
  };

  const handleProcessFiles = async () => {
    if (!rootHandle) return;
    const rejects = files.filter(f => f.status === 'reject');
    if (rejects.length === 0) return;
    if (!confirm(`Move ${rejects.length} files to '_Trash'?`)) return;

    setStatus('processing');
    try {
      // @ts-ignore
      const trashHandle = await rootHandle.getDirectoryHandle('_Trash', { create: true });
      for (const file of rejects) { 
        // @ts-ignore
        await file.handle.move(trashHandle); 
      }
      setFiles(prev => prev.filter(f => f.status !== 'reject'));
      setStatus('ready');
    } catch (error) { alert("Error moving files."); setStatus('ready'); }
  };

  const sortedFiles = useMemo(() => {
    const sorted = [...files];
    if (sortMode === 'name_asc') {
      sorted.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
    } else if (sortMode === 'name_desc') {
      sorted.sort((a, b) => b.name.localeCompare(a.name, undefined, { numeric: true, sensitivity: 'base' }));
    } else if (sortMode === 'status') {
      const rank = { keep: 1, unreviewed: 2, reject: 3 };
      sorted.sort((a, b) => rank[a.status] - rank[b.status]);
    }
    return sorted;
  }, [files, sortMode]);

  const rejectCount = files.filter(f => f.status === 'reject').length;

  return (
    <div className="h-screen flex flex-col bg-[#0f0f0f] text-white overflow-hidden font-sans selection:bg-blue-500/30">
      
      {status === 'idle' && (
        <div className="h-full flex flex-col items-center justify-center space-y-6">
          <div className="mb-6 transform transition-all hover:scale-110 duration-300">
            <Logo className="w-24 h-24 shadow-2xl shadow-yellow-500/20" />
          </div>
          <h1 className="text-6xl font-black tracking-tighter text-white">FlashCull</h1>
          <p className="text-gray-400 text-lg">Local-First. Privacy-First. Blazing Fast.</p>
          <button onClick={handleOpenFolder} className="bg-white text-black hover:bg-gray-200 px-8 py-4 rounded-xl font-bold text-lg transition-all transform hover:scale-105">Open Folder</button>
        </div>
      )}

      {(status === 'ready' || status === 'processing') && (
        <div className="h-full flex flex-col">
          
          <header className="h-16 px-6 border-b border-gray-800 flex justify-between items-center bg-[#1a1a1a]">
            <div className="flex items-center gap-3">
              <Logo className="w-8 h-8" />
              <span className="font-bold text-xl tracking-tight">FlashCull</span>
            </div>
            <div className="flex gap-3">
              {rejectCount > 0 && (
                <button onClick={handleProcessFiles} className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-lg shadow-red-900/20">
                  <Trash2 size={16} /> Move {rejectCount} to Trash
                </button>
              )}
              <button onClick={() => setStatus('idle')} className="text-sm text-gray-400 hover:text-white px-4 py-2 hover:bg-gray-800 rounded-lg transition-colors">Close</button>
            </div>
          </header>

          <div className="h-14 px-6 border-b border-gray-800 flex justify-between items-center bg-[#141414]">
            <div className="relative">
              <button onClick={(e) => { e.stopPropagation(); setIsSortMenuOpen(!isSortMenuOpen); }} className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors">
                Sort By <ChevronDown size={14} className={`transition-transform ${isSortMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              {isSortMenuOpen && (
                <div className="absolute top-full left-0 mt-2 w-48 bg-[#1a1a1a] border border-gray-700 rounded-lg shadow-2xl overflow-hidden z-50">
                  <button onClick={() => setSortMode('name_asc')} className="w-full text-left px-4 py-3 text-sm hover:bg-gray-800 flex items-center justify-between"><span className="flex items-center gap-2"><ArrowDownAZ size={14} /> Name (A-Z)</span>{sortMode === 'name_asc' && <Check size={14} className="text-blue-400" />}</button>
                  <button onClick={() => setSortMode('name_desc')} className="w-full text-left px-4 py-3 text-sm hover:bg-gray-800 flex items-center justify-between"><span className="flex items-center gap-2"><ArrowUpAZ size={14} /> Name (Z-A)</span>{sortMode === 'name_desc' && <Check size={14} className="text-blue-400" />}</button>
                  <div className="h-px bg-gray-700 my-1 mx-2"></div>
                  <button onClick={() => setSortMode('status')} className="w-full text-left px-4 py-3 text-sm hover:bg-gray-800 flex items-center justify-between"><span className="flex items-center gap-2"><ListFilter size={14} /> Status</span>{sortMode === 'status' && <Check size={14} className="text-blue-400" />}</button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 w-32">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Size</span>
              <div className="flex items-center gap-2 flex-1 group">
                <ImageIcon size={22} className="text-gray-500" />
                <input type="range" min="4" max="12" step="1" value={columnCount} onChange={(e) => setColumnCount(Number(e.target.value))} className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400" />
                <LayoutGrid size={16} className="text-gray-500" />
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
            {status === 'processing' ? (
              <div className="h-full flex items-center justify-center text-xl text-gray-400 animate-pulse">Moving files to _Trash...</div>
            ) : (
              <div className="grid gap-4 transition-all duration-300 ease-in-out" style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}>
                {sortedFiles.map((file, idx) => (
                  <div key={file.name} className="aspect-square w-full"> 
                    <Thumbnail fileHandle={file.handle} status={file.status} onClick={() => setSelectedIndex(idx)} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {selectedIndex !== null && (
        <ReviewMode 
          fileEntry={sortedFiles[selectedIndex]}
          allFiles={sortedFiles}
          selectedIndex={selectedIndex}
          onClose={() => setSelectedIndex(null)}
          onNavigate={(i: number) => { if (i >= 0 && i < sortedFiles.length) setSelectedIndex(i); }}
          onMark={(s: 'keep' | 'reject' | 'unreviewed') => updateStatus(files.indexOf(sortedFiles[selectedIndex]), s)}
        />
      )}
    </div>
  );
}

export default App;