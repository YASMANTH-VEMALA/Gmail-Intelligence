'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Bold, Code, Italic, List, Underline } from 'lucide-react';

export type RichTextEditorHandle = {
  focus: () => void;
  insertText: (text: string) => void;
  insertHtml: (html: string) => void;
  insertLink: (url: string) => void;
};

type RichTextEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  id: string;
  showToolbar: boolean;
  minHeight?: number;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function hasRichTextContent(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, '')
    .replace(/<\/(div|p|li|pre)>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim()
    .length > 0;
}

const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(function RichTextEditor(
  { value, onChange, placeholder, id, showToolbar, minHeight = 240 },
  ref
) {
  const editorRef = useRef<HTMLDivElement>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const [isEmpty, setIsEmpty] = useState(!hasRichTextContent(value));

  const saveSelection = () => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) return;
    const anchorNode = selection.anchorNode;
    if (anchorNode && editor.contains(anchorNode)) {
      savedRangeRef.current = selection.getRangeAt(0).cloneRange();
    }
  };

  const restoreSelection = () => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const selection = window.getSelection();
    if (!selection) return;
    selection.removeAllRanges();
    if (savedRangeRef.current) {
      selection.addRange(savedRangeRef.current);
      return;
    }

    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    selection.addRange(range);
  };

  const syncValue = () => {
    const html = editorRef.current?.innerHTML || '';
    setIsEmpty(!hasRichTextContent(html));
    onChange(html);
    saveSelection();
  };

  const runCommand = (command: string, commandValue?: string) => {
    restoreSelection();
    document.execCommand(command, false, commandValue);
    syncValue();
  };

  const insertHtml = (html: string) => {
    restoreSelection();
    document.execCommand('insertHTML', false, html);
    syncValue();
  };

  useImperativeHandle(ref, () => ({
    focus: () => editorRef.current?.focus(),
    insertText: (text: string) => {
      insertHtml(escapeHtml(text).replace(/\n/g, '<br>'));
    },
    insertHtml,
    insertLink: (url: string) => {
      if (!url) return;
      runCommand('createLink', url);
      const selection = window.getSelection();
      const anchor = selection?.anchorNode?.parentElement?.closest('a');
      if (anchor) {
        anchor.setAttribute('target', '_blank');
        anchor.setAttribute('rel', 'noopener noreferrer');
      }
      syncValue();
    },
  }));

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (editor.innerHTML !== value) {
      editor.innerHTML = value || '';
    }
    setIsEmpty(!hasRichTextContent(value));
  }, [value]);

  const toolbarButtonStyle = { height: 28, width: 28 };

  return (
    <div className="rich-text-editor-shell">
      {showToolbar && (
        <div className="rich-text-toolbar">
          <button type="button" className="btn-icon" title="Bold" onMouseDown={(e) => e.preventDefault()} onClick={() => runCommand('bold')} style={toolbarButtonStyle}><Bold size={14} /></button>
          <button type="button" className="btn-icon" title="Italic" onMouseDown={(e) => e.preventDefault()} onClick={() => runCommand('italic')} style={toolbarButtonStyle}><Italic size={14} /></button>
          <button type="button" className="btn-icon" title="Underline" onMouseDown={(e) => e.preventDefault()} onClick={() => runCommand('underline')} style={toolbarButtonStyle}><Underline size={14} /></button>
          <button type="button" className="btn-icon" title="Code Block" onMouseDown={(e) => e.preventDefault()} onClick={() => runCommand('formatBlock', 'pre')} style={toolbarButtonStyle}><Code size={14} /></button>
          <button type="button" className="btn-icon" title="Bullet List" onMouseDown={(e) => e.preventDefault()} onClick={() => runCommand('insertUnorderedList')} style={toolbarButtonStyle}><List size={14} /></button>
        </div>
      )}
      <div
        ref={editorRef}
        id={id}
        className="rich-text-editor"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={placeholder}
        data-placeholder={placeholder}
        data-empty={isEmpty ? 'true' : 'false'}
        onInput={syncValue}
        onKeyUp={saveSelection}
        onMouseUp={saveSelection}
        onBlur={saveSelection}
        onFocus={saveSelection}
        onPaste={(e) => {
          e.preventDefault();
          const text = e.clipboardData.getData('text/plain');
          insertHtml(escapeHtml(text).replace(/\n/g, '<br>'));
        }}
        style={{ minHeight }}
      />
    </div>
  );
});

export default RichTextEditor;
