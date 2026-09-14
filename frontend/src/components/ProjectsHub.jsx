import React, { useState, useEffect, useRef } from 'react';
import {
  Film,
  Search,
  Plus,
  Link2,
  Smartphone,
  Tv,
  Square,
  MoreVertical,
  Play,
  Sun,
  Moon,
  AlertTriangle,
  FolderOpen,
  Copy,
  Trash2,
  Edit3,
  X,
  Check,
  Sparkles,
  AlertCircle,
  FileVideo,
  Upload
} from 'lucide-react';
import { useEditorStore } from '../store/useEditorStore';
import { browseLocalFile } from '../engine/mediaLinker';
import './ProjectsHub.css';

const BACKEND_URL = 'http://127.0.0.1:8000';

export const ProjectsHub = () => {
  const {
    projectsList,
    fetchProjectsList,
    loadProject,
    createNewProject,
    linkLocalVideoFile,
    relinkProjectMedia,
    deleteCurrentProject,
    setCurrentView,
    activeProjectId,
    theme,
    toggleTheme
  } = useEditorStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | '9:16' | '16:9' | '1:1'
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  // Apple Modal States
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newAspect, setNewAspect] = useState('9:16');
  const [newLinkedFile, setNewLinkedFile] = useState(null);
  const [isLinking, setIsLinking] = useState(false);

  // Rename Modal State
  const [renameModal, setRenameModal] = useState({ isOpen: false, project: null, title: '' });

  // Delete Modal State
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, project: null });

  const titleInputRef = useRef(null);
  const renameInputRef = useRef(null);
  const modalFileInputRef = useRef(null);

  useEffect(() => {
    fetchProjectsList();
  }, [fetchProjectsList]);

  // Close context menu on outside click
  useEffect(() => {
    const handleClick = () => setMenuOpenId(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  // Autofocus title input when New Project modal opens
  useEffect(() => {
    if (isNewModalOpen && titleInputRef.current) {
      setTimeout(() => {
        titleInputRef.current?.focus();
        titleInputRef.current?.select();
      }, 50);
    }
  }, [isNewModalOpen]);

  // Autofocus rename input when Rename modal opens
  useEffect(() => {
    if (renameModal.isOpen && renameInputRef.current) {
      setTimeout(() => {
        renameInputRef.current?.focus();
        renameInputRef.current?.select();
      }, 50);
    }
  }, [renameModal.isOpen]);

  const triggerToast = (msg) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2400);
  };

  const filteredProjects = (projectsList || []).filter((p) => {
    const aspect = p.aspectRatio || p.aspect || '9:16';
    if (activeFilter === '9:16' && aspect !== '9:16') return false;
    if (activeFilter === '16:9' && aspect !== '16:9') return false;
    if (activeFilter === '1:1' && aspect !== '1:1') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const titleMatch = (p.title || '').toLowerCase().includes(q);
      const presetMatch = (p.activePresetId || p.preset || '').toLowerCase().includes(q);
      const fileMatch = (p.videoFilename || '').toLowerCase().includes(q);
      if (!titleMatch && !presetMatch && !fileMatch) return false;
    }
    return true;
  });

  // Open the Apple-style New Project Modal
  const openNewProjectModal = (aspect = '9:16', defaultTitle = '') => {
    const defaultName = defaultTitle || `New ${aspect === '9:16' ? 'Vertical' : aspect === '16:9' ? 'Widescreen' : 'Square'} Project #${projectsList.length + 1}`;
    setNewTitle(defaultName);
    setNewAspect(aspect);
    setNewLinkedFile(null);
    setIsNewModalOpen(true);
  };

  // Browse local file directly from the New Project modal (Zero-Copy)
  const handleBrowseLocalFileInModal = async () => {
    setIsLinking(true);
    try {
      const result = await browseLocalFile();
      if (!result.cancelled) {
        setNewLinkedFile(result);
        if (!newTitle || newTitle.startsWith('New ')) {
          const cleanName = result.filename.replace(/\.[^/.]+$/, "");
          setNewTitle(cleanName);
        }
        if (result.width && result.height) {
          if (result.width > result.height) {
            setNewAspect('16:9');
          } else if (result.width === result.height) {
            setNewAspect('1:1');
          } else {
            setNewAspect('9:16');
          }
        }
      }
    } catch (e) {
      console.warn('File browse error, falling back to browser picker:', e);
      if (modalFileInputRef.current) {
        modalFileInputRef.current.click();
      }
    } finally {
      setIsLinking(false);
    }
  };

  // Fallback: handle browser HTML file picker selection
  const handleModalBrowserFileSelected = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    const sizeMb = Math.round((file.size / (1024 * 1024)) * 10) / 10;

    const tempVideo = document.createElement('video');
    tempVideo.preload = 'metadata';
    tempVideo.src = objectUrl;
    tempVideo.onloadedmetadata = () => {
      const width = tempVideo.videoWidth || 1080;
      const height = tempVideo.videoHeight || 1920;
      const duration = tempVideo.duration || 0;

      setNewLinkedFile({
        file: file,
        filePath: null,
        filename: file.name,
        sizeMb: sizeMb,
        duration: duration,
        width: width,
        height: height,
        streamUrl: objectUrl
      });

      if (!newTitle || newTitle.startsWith('New ')) {
        const cleanName = file.name.replace(/\.[^/.]+$/, "");
        setNewTitle(cleanName);
      }
      if (width > height) {
        setNewAspect('16:9');
      } else if (width === height) {
        setNewAspect('1:1');
      } else {
        setNewAspect('9:16');
      }
    };
    e.target.value = '';
  };

  // Submit and create new project
  const handleConfirmCreate = async (e) => {
    if (e) e.preventDefault();
    const titleToUse = newTitle.trim() || `New ${newAspect} Project`;

    setIsNewModalOpen(false);
    setIsLinking(false);
    await createNewProject({
      aspect: newAspect,
      title: titleToUse,
      linkedPath: newLinkedFile ? newLinkedFile.filePath : null,
      videoFile: newLinkedFile ? newLinkedFile.file : null,
      videoFilename: newLinkedFile ? (newLinkedFile.savedFilename || newLinkedFile.filename) : null,
      videoUrl: newLinkedFile ? newLinkedFile.streamUrl : null,
      presetId: 'mrbeast'
    });
    triggerToast(`Created "${titleToUse}"`);
  };

  const handleOptionsClick = (e, id) => {
    e.stopPropagation();
    setMenuOpenId(menuOpenId === id ? null : id);
  };

  // Rename Handlers
  const openRenameModal = (p) => {
    setRenameModal({ isOpen: true, project: p, title: p.title });
  };

  const handleConfirmRename = (e) => {
    if (e) e.preventDefault();
    if (renameModal.project && renameModal.title.trim()) {
      const updatedTitle = renameModal.title.trim();
      useEditorStore.getState().renameCurrentProject(updatedTitle);
      setRenameModal({ isOpen: false, project: null, title: '' });
      fetchProjectsList();
      triggerToast('Project renamed!');
    }
  };

  // Duplicate Handler
  const handleDuplicate = async (p) => {
    await useEditorStore.getState().createNewProject({
      aspect: p.aspectRatio || p.aspect || '9:16',
      title: `Copy of ${p.title}`,
      linkedPath: p.linkedSourcePath
    });
    fetchProjectsList();
    triggerToast('Duplicated project!');
  };

  // Delete Handlers
  const openDeleteModal = (p) => {
    setDeleteModal({ isOpen: true, project: p });
  };

  const handleConfirmDelete = async () => {
    if (deleteModal.project) {
      const title = deleteModal.project.title;
      await deleteCurrentProject(deleteModal.project.id);
      setDeleteModal({ isOpen: false, project: null });
      fetchProjectsList();
      triggerToast(`Deleted "${title}".`);
    }
  };

  const handleOpenProject = (id, title) => {
    triggerToast(`Opening "${title}"...`);
    loadProject(id);
  };

  return (
    <div className="studio-hub-container">
      {/* Studio Header Navigation */}
      <header className="studio-nav">
        <div className="nav-left">
          <div className="brand-logo">
            <Film size={18} strokeWidth={2.3} />
          </div>
          <div className="brand-info">
            <div className="brand-title">AutoCaption Studio</div>
            <div className="brand-sub">Projects Hub</div>
          </div>
        </div>

        <div className="nav-center">
          <div className="search-icon">
            <Search size={15} strokeWidth={2.2} />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search projects by title, caption keyword, or format..."
            className="search-input"
          />
        </div>

        <div className="nav-right">
          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="btn-theme-toggle"
            aria-label="Toggle Light/Dark Theme"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          >
            {theme === 'dark' ? (
              <Sun size={17} strokeWidth={2.2} />
            ) : (
              <Moon size={17} strokeWidth={2.2} />
            )}
          </button>

          {/* Import Video Secondary Button */}
          <button
            onClick={linkLocalVideoFile}
            className="filter-pill"
            style={{ height: '38px', display: 'flex', alignItems: 'center', gap: '6px', padding: '0 14px' }}
            title="Import video (.mp4, .avi, .mov, .mkv)"
          >
            <FolderOpen size={15} />
            <span>Import Video</span>
          </button>

          {/* Sleek Dark New Project Button */}
          <button
            onClick={() => openNewProjectModal('9:16')}
            className="btn-new-project"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>New Project</span>
          </button>
        </div>
      </header>

      {/* Main Studio Content */}
      <main className="studio-content">
        {/* Quick Start Shelf */}
        <section className="quick-start-section">
          <div className="section-header">
            <span className="section-title">⚡ Quick Start Canvas</span>
          </div>

          <div className="quick-shelf-grid">
            <div className="shelf-card" onClick={() => openNewProjectModal('9:16')}>
              <div className="shelf-icon-wrap" style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}>
                <Smartphone size={22} strokeWidth={2.2} />
              </div>
              <div className="shelf-info">
                <span className="shelf-title">9:16 Vertical</span>
                <span className="shelf-desc">Shorts, Reels & TikTok</span>
              </div>
            </div>

            <div className="shelf-card" onClick={() => openNewProjectModal('16:9')}>
              <div className="shelf-icon-wrap" style={{ background: 'rgba(2, 132, 199, 0.08)', color: '#0284c7', border: '1px solid rgba(2, 132, 199, 0.2)' }}>
                <Tv size={22} strokeWidth={2.2} />
              </div>
              <div className="shelf-info">
                <span className="shelf-title">16:9 Widescreen</span>
                <span className="shelf-desc">YouTube & Podcasts</span>
              </div>
            </div>

            <div className="shelf-card" onClick={() => openNewProjectModal('1:1')}>
              <div className="shelf-icon-wrap" style={{ background: 'rgba(16, 185, 129, 0.08)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                <Square size={20} strokeWidth={2.2} />
              </div>
              <div className="shelf-info">
                <span className="shelf-title">1:1 Square</span>
                <span className="shelf-desc">Instagram & LinkedIn Feed</span>
              </div>
            </div>

            <div className="shelf-card" style={{ border: '1.5px dashed var(--border-hover)', background: 'var(--bg-surface)' }} onClick={linkLocalVideoFile}>
              <div className="shelf-icon-wrap" style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', border: '1px solid var(--btn-primary-border)' }}>
                <FolderOpen size={20} strokeWidth={2.2} />
              </div>
              <div className="shelf-info">
                <span className="shelf-title">Import Video</span>
                <span className="shelf-desc">.mp4, .avi, .mov & other formats</span>
              </div>
            </div>
          </div>
        </section>

        {/* Filters Row */}
        <section className="filter-row">
          <div className="filter-pills">
            <button
              className={`filter-pill ${activeFilter === 'all' ? 'active' : ''}`}
              onClick={() => setActiveFilter('all')}
            >
              All Projects ({projectsList.length})
            </button>
            <button
              className={`filter-pill ${activeFilter === '9:16' ? 'active' : ''}`}
              onClick={() => setActiveFilter('9:16')}
            >
              📱 9:16 Shorts
            </button>
            <button
              className={`filter-pill ${activeFilter === '16:9' ? 'active' : ''}`}
              onClick={() => setActiveFilter('16:9')}
            >
              🖥️ 16:9 Widescreen
            </button>
            <button
              className={`filter-pill ${activeFilter === '1:1' ? 'active' : ''}`}
              onClick={() => setActiveFilter('1:1')}
            >
              ⏹️ 1:1 Square
            </button>
          </div>

          <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
            Showing {filteredProjects.length} of {projectsList.length} projects
          </span>
        </section>

        {/* 4-Column Projects Grid or Empty State */}
        {filteredProjects.length === 0 ? (
          <div style={{
            padding: '64px 24px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '14px',
            background: 'var(--bg-panel)',
            border: '1.5px dashed var(--border-subtle)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-subtle)'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-primary)'
            }}>
              <Film size={26} strokeWidth={2} />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                {searchQuery.trim() || activeFilter !== 'all' ? 'No Matching Projects' : 'No Projects Yet'}
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0 0', maxWidth: '360px', lineHeight: '1.4' }}>
                {searchQuery.trim() || activeFilter !== 'all'
                  ? 'Try clearing your search query or selecting "All Projects".'
                  : 'Get started by creating a new project above or importing video footage.'}
              </p>
            </div>
            <button
              onClick={() => openNewProjectModal('9:16')}
              className="btn-primary"
              style={{ height: '38px', padding: '0 20px', borderRadius: 'var(--radius-pill)', fontSize: '13px', marginTop: '6px' }}
            >
              <Plus size={16} strokeWidth={2.5} />
              <span>Create New Project</span>
            </button>
          </div>
        ) : (
          <section className="projects-grid">
            {filteredProjects.map((p) => {
              const isCurrent = activeProjectId === p.id;
              const aspect = p.aspectRatio || p.aspect || '9:16';
              const formattedDuration = typeof p.duration === 'string'
                ? p.duration
                : typeof p.duration === 'number'
                  ? `${Math.floor(p.duration / 60)}:${(Math.floor(p.duration % 60)).toString().padStart(2, '0')}`
                  : '0:30';

              const linesText = p.linesCount || p.lines || (p.segments ? p.segments.length : 0);
              const presetText = p.activePresetName || p.preset || p.activePresetId || 'MrBeast Pop';

              // Resolve authentic video snapshot thumbnail
              const rawThumb = p.thumbnailUrl || p.thumb;
              const isPlaceholder = !rawThumb || rawThumb.includes('unsplash.com');
              const videoSnapshotUrl = (p.linkedSourcePath || p.videoFilename)
                ? `${BACKEND_URL}/api/media/thumbnail?filename=${encodeURIComponent(p.videoFilename || '')}&path=${encodeURIComponent(p.linkedSourcePath || '')}`
                : null;
              const thumbUrl = !isPlaceholder ? rawThumb : videoSnapshotUrl;

              // Only show snippet text if it's a real user caption and not a dummy template string
              const isDummySnippet = !p.captionSnippet || 
                p.captionSnippet === 'SAMPLE CAPTION 🚀' || 
                p.captionSnippet === 'Studio Caption' || 
                p.captionSnippet === 'NEW PROJECT 🔥';
              const captionText = !isDummySnippet ? p.captionSnippet : null;
              const captionClass = p.captionStyleClass || p.captionClass || 'cap-style-mrbeast';

              return (
                <div
                  key={p.id}
                  className={`project-card ${menuOpenId === p.id ? 'menu-active' : ''}`}
                  style={{ zIndex: menuOpenId === p.id ? 60 : 1 }}
                  onClick={() => handleOpenProject(p.id, p.title)}
                >
                  <div className="card-stage">
                    <span className="stage-badge-top-left">{aspect}</span>
                    <span className="stage-badge-top-right">{formattedDuration}</span>

                    {isCurrent && (
                      <div className="active-project-tag">
                        <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#FFF' }} />
                        ACTIVE
                      </div>
                    )}

                    {p.mediaOffline && (
                      <div style={{ position: 'absolute', bottom: '10px', right: '10px', background: 'rgba(239, 68, 68, 0.9)', color: '#FFF', fontSize: '9.5px', fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--radius-pill)', display: 'flex', alignItems: 'center', gap: '4px', zIndex: 2 }}>
                        <AlertTriangle size={11} />
                        OFFLINE
                      </div>
                    )}

                    {thumbUrl ? (
                      <img
                        className="card-thumb"
                        src={thumbUrl}
                        alt={p.title}
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          const fallback = e.currentTarget.parentElement?.querySelector('.card-thumb-fallback');
                          if (fallback) fallback.style.display = 'flex';
                        }}
                      />
                    ) : null}

                    <div
                      className="card-thumb-fallback"
                      style={{
                        display: thumbUrl ? 'none' : 'flex',
                        position: 'absolute',
                        inset: 0,
                        background: 'linear-gradient(135deg, #111219 0%, #1c1d29 100%)',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        color: 'var(--text-tertiary)'
                      }}
                    >
                      <Film size={26} style={{ opacity: 0.35 }} />
                      <span style={{ fontSize: '11px', fontWeight: 600, opacity: 0.5, letterSpacing: '0.04em' }}>VIDEO SNAPSHOT</span>
                    </div>

                    {captionText && (
                      <div className="stage-caption">
                        <div className={captionClass}>{captionText}</div>
                      </div>
                    )}

                    <div className="card-stage-scrim">
                      <button
                        className="btn-stage-open"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenProject(p.id, p.title);
                        }}
                      >
                        <Play size={13} fill="currentColor" />
                        <span>Open Project</span>
                      </button>
                    </div>
                  </div>

                  <div className="card-body">
                    <div className="card-title-row">
                      <span className="card-title" title={p.title}>{p.title}</span>
                      <button
                        className="card-menu-btn"
                        title={menuOpenId === p.id ? undefined : "Project Options"}
                        onClick={(e) => handleOptionsClick(e, p.id)}
                      >
                        <MoreVertical size={16} />
                      </button>

                      {menuOpenId === p.id && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            position: 'absolute',
                            right: '0',
                            top: '32px',
                            background: 'var(--bg-panel)',
                            backdropFilter: 'blur(16px)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-lg)',
                            boxShadow: 'var(--shadow-popover)',
                            zIndex: 100,
                            minWidth: '160px',
                            padding: '6px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '3px'
                          }}
                        >
                          <button
                            onClick={() => { setMenuOpenId(null); openRenameModal(p); }}
                            className="btn-ghost"
                            style={{ width: '100%', justifyContent: 'flex-start', padding: '7px 10px', fontSize: '12px', gap: '9px' }}
                          >
                            <Edit3 size={14} /> Rename
                          </button>
                          <button
                            onClick={() => { setMenuOpenId(null); handleDuplicate(p); }}
                            className="btn-ghost"
                            style={{ width: '100%', justifyContent: 'flex-start', padding: '7px 10px', fontSize: '12px', gap: '9px' }}
                          >
                            <Copy size={14} /> Duplicate
                          </button>
                          {p.isMediaLinked && (
                            <button
                              onClick={() => { setMenuOpenId(null); relinkProjectMedia(p.id); }}
                              className="btn-ghost"
                              style={{ width: '100%', justifyContent: 'flex-start', padding: '7px 10px', fontSize: '12px', gap: '9px' }}
                            >
                              <Link2 size={14} /> Relink Media
                            </button>
                          )}
                          <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '4px 0' }} />
                          <button
                            onClick={() => { setMenuOpenId(null); openDeleteModal(p); }}
                            className="btn-ghost"
                            style={{ width: '100%', justifyContent: 'flex-start', padding: '7px 10px', fontSize: '12px', gap: '9px', color: 'var(--system-error)' }}
                          >
                            <Trash2 size={14} /> Delete
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="card-metrics">
                      <span>{linesText} lines</span>
                      <span>•</span>
                      <span className="card-preset-tag">{presetText}</span>
                    </div>

                    <div className="card-footer-row">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <div className="card-status-dot" />
                        <span>Render Ready</span>
                      </div>
                      <span>{p.edited || (p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : 'Just now')}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </section>
        )}
      </main>

      {/* ========================================================================
          APPLE-STYLE NEW PROJECT MODAL DIALOG
          ======================================================================== */}
      {isNewModalOpen && (
        <div className="apple-modal-backdrop" onClick={() => {
          setIsNewModalOpen(false);
          setIsLinking(false);
        }}>
          <div className="apple-modal-window" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="apple-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '12px',
                  background: 'var(--btn-primary-bg)',
                  color: 'var(--btn-primary-text)',
                  border: '1px solid var(--btn-primary-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.16)'
                }}>
                  <Sparkles size={18} />
                </div>
                <div>
                  <h2 className="apple-modal-title">New Studio Project</h2>
                  <p className="apple-modal-subtitle">
                    Select canvas aspect ratio and media source
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setIsNewModalOpen(false);
                  setIsLinking(false);
                }}
                className="apple-modal-close-btn"
                title="Close dialog (Esc)"
              >
                <X size={15} />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleConfirmCreate} className="apple-modal-body">
              {/* Project Title Input */}
              <div>
                <label className="apple-input-label">Project Title</label>
                <input
                  ref={titleInputRef}
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Viral Hook Teaser 01"
                  className="apple-input-field"
                  required
                />
              </div>

              {/* Aspect Ratio 3-Card Apple Selector */}
              <div>
                <label className="apple-input-label">Canvas Format</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div
                    className={`apple-aspect-choice ${newAspect === '9:16' ? 'selected' : ''}`}
                    onClick={() => setNewAspect('9:16')}
                  >
                    <Smartphone size={22} color={newAspect === '9:16' ? 'var(--btn-primary-text)' : 'var(--text-primary)'} />
                    <div>
                      <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)' }}>9:16 Vertical</div>
                      <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>Shorts & Reels</div>
                    </div>
                  </div>

                  <div
                    className={`apple-aspect-choice ${newAspect === '16:9' ? 'selected' : ''}`}
                    onClick={() => setNewAspect('16:9')}
                  >
                    <Tv size={22} color={newAspect === '16:9' ? '#0284c7' : 'var(--text-primary)'} />
                    <div>
                      <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)' }}>16:9 Cinema</div>
                      <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>YouTube & Video</div>
                    </div>
                  </div>

                  <div
                    className={`apple-aspect-choice ${newAspect === '1:1' ? 'selected' : ''}`}
                    onClick={() => setNewAspect('1:1')}
                  >
                    <Square size={20} color={newAspect === '1:1' ? '#10b981' : 'var(--text-primary)'} />
                    <div>
                      <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)' }}>1:1 Square</div>
                      <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>Instagram Feed</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Media Source (Zero-Copy) */}
              <div>
                <label className="apple-input-label">Media Source (Zero-Copy)</label>
                {newLinkedFile ? (
                  <div style={{
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#10B981', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Check size={16} />
                      </div>
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {newLinkedFile.filename}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          {newLinkedFile.sizeMb} MB • {Math.floor((newLinkedFile.duration || 0) / 60)}:{(Math.floor((newLinkedFile.duration || 0) % 60)).toString().padStart(2, '0')} • Attached
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setNewLinkedFile(null)}
                      className="btn-ghost"
                      style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--text-tertiary)' }}
                    >
                      Clear
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <input
                      ref={modalFileInputRef}
                      type="file"
                      accept="video/*,audio/*"
                      style={{ display: 'none' }}
                      onChange={handleModalBrowserFileSelected}
                    />
                    <button
                      type="button"
                      onClick={handleBrowseLocalFileInModal}
                      disabled={isLinking}
                      className="btn-secondary"
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-md)',
                        border: '1.5px dashed var(--border-hover)',
                        background: 'var(--bg-surface)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        fontSize: '12.5px',
                        fontWeight: 600,
                        opacity: isLinking ? 0.7 : 1,
                        cursor: isLinking ? 'wait' : 'pointer'
                      }}
                    >
                      <FolderOpen size={16} />
                      <span>{isLinking ? 'Opening File Dialog...' : 'Choose Video File (.mp4, .avi, .mov, .mkv)'}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Hidden submit button to allow Enter key to submit */}
              <button type="submit" style={{ display: 'none' }} />
            </form>

            {/* Footer Actions */}
            <div className="apple-modal-footer">
              <button
                type="button"
                onClick={() => {
                  setIsNewModalOpen(false);
                  setIsLinking(false);
                }}
                className="btn-secondary"
                style={{ height: '36px', padding: '0 16px', fontSize: '12.5px', borderRadius: 'var(--radius-pill)' }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmCreate}
                className="btn-primary"
                style={{ height: '36px', padding: '0 20px', fontSize: '12.5px', borderRadius: 'var(--radius-pill)', gap: '6px' }}
              >
                <span>Create Project</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================
          APPLE-STYLE RENAME PROJECT MODAL DIALOG
          ======================================================================== */}
      {renameModal.isOpen && (
        <div className="apple-modal-backdrop" onClick={() => setRenameModal({ isOpen: false, project: null, title: '' })}>
          <div className="apple-modal-window" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div className="apple-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '10px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-primary)'
                }}>
                  <Edit3 size={16} />
                </div>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                    Rename Project
                  </h3>
                  <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                    Enter a new display title for this project.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setRenameModal({ isOpen: false, project: null, title: '' })}
                className="apple-modal-close-btn"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleConfirmRename} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input
                ref={renameInputRef}
                type="text"
                value={renameModal.title}
                onChange={(e) => setRenameModal(prev => ({ ...prev, title: e.target.value }))}
                className="apple-input-field"
                placeholder="Project title..."
                required
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={() => setRenameModal({ isOpen: false, project: null, title: '' })}
                  className="btn-secondary"
                  style={{ height: '34px', padding: '0 14px', fontSize: '12px', borderRadius: 'var(--radius-pill)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ height: '34px', padding: '0 18px', fontSize: '12px', borderRadius: 'var(--radius-pill)' }}
                >
                  Save Title
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================
          APPLE-STYLE DELETE CONFIRMATION DIALOG
          ======================================================================== */}
      {deleteModal.isOpen && (
        <div className="apple-modal-backdrop" onClick={() => setDeleteModal({ isOpen: false, project: null })}>
          <div className="apple-modal-window" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '14px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#EF4444'
              }}>
                <AlertCircle size={24} />
              </div>

              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  Delete Project?
                </h3>
                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '6px 0 0 0', lineHeight: '1.4' }}>
                  Are you sure you want to delete <strong>"{deleteModal.project?.title}"</strong>? This will permanently remove its captions and settings.
                </p>
              </div>

              <div style={{ display: 'flex', width: '100%', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setDeleteModal({ isOpen: false, project: null })}
                  className="btn-secondary"
                  style={{ flex: 1, height: '38px', borderRadius: 'var(--radius-pill)', fontSize: '12.5px' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  style={{
                    flex: 1,
                    height: '38px',
                    borderRadius: 'var(--radius-pill)',
                    background: '#DC2626',
                    color: '#FFFFFF',
                    border: '1px solid #DC2626',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(220, 38, 38, 0.3)'
                  }}
                >
                  Delete Project
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      <div className={`toast ${showToast ? 'show' : ''}`} style={{
        position: 'fixed',
        bottom: '24px',
        left: '50%',
        transform: showToast ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(80px)',
        background: 'var(--btn-primary-bg)',
        color: 'var(--btn-primary-text)',
        border: '1px solid var(--btn-primary-border)',
        padding: '10px 20px',
        borderRadius: 'var(--radius-pill)',
        fontSize: '13px',
        fontWeight: '600',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.25)',
        zIndex: 300,
        opacity: showToast ? 1 : 0,
        transition: 'all 220ms ease'
      }}>
        {toastMessage}
      </div>
    </div>
  );
};
