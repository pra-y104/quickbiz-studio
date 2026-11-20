import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { getFontFamily, type CreativeTextNode } from '@quickbiz/shared';

export interface TextEditorOverlayProps {
  readonly node: CreativeTextNode;
  /** Document pixel → screen pixel factor. */
  readonly scale: number;
  readonly canvasRef: RefObject<HTMLCanvasElement | null>;
  /** Live preview while typing, so the canvas shows the text being written. */
  readonly onPreview: (text: string) => void;
  readonly onCommit: (text: string) => void;
  readonly onCancel: () => void;
}

interface Placement {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly fontSize: number;
}

/**
 * In-place text editor.
 *
 * Rendered as a real `<textarea>` so Android shows the soft keyboard, the customer
 * can select and replace text with the native caret, and paste works normally.
 *
 * The field is positioned in viewport coordinates from the canvas rectangle, which
 * keeps it aligned with the artboard at any pan or zoom. Rotation is applied so the
 * editor sits over rotated text.
 */
export function TextEditorOverlay(props: TextEditorOverlayProps) {
  const { node, scale, canvasRef, onPreview, onCommit, onCancel } = props;
  const [value, setValue] = useState(node.text);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const committedRef = useRef(false);

  useLayoutEffect(() => {
    const measure = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const fontSize = Math.max(11, node.fontSize * scale);

      setPlacement({
        left: rect.left + node.x * scale,
        top: rect.top + node.y * scale,
        width: Math.max(48, node.width * scale),
        height: Math.max(fontSize * 1.4, node.height * scale),
        fontSize,
      });
    };

    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [canvasRef, node.fontSize, node.height, node.width, node.x, node.y, scale]);

  // Focus via the callback ref, not an effect: on the first render the component
  // returns null while it measures the canvas, so a [] effect would run before the
  // textarea exists and the Android keyboard would never open.
  const attachTextarea = useCallback((element: HTMLTextAreaElement | null) => {
    textareaRef.current = element;
    if (!element) return;

    element.focus({ preventScroll: false });
    const end = element.value.length;
    element.setSelectionRange(end, end);
  }, []);

  const commit = () => {
    if (committedRef.current) return;
    committedRef.current = true;
    onCommit(value);
  };

  if (!placement) return null;

  const family = getFontFamily(node.fontFamily).stack;

  return (
    <textarea
      ref={attachTextarea}
      aria-label={`Edit text: ${node.name}`}
      value={value}
      rows={Math.max(1, Math.round(placement.height / placement.fontSize))}
      spellCheck
      className="fixed z-50 resize-none rounded-sm border-2 border-primary bg-white/95 p-0 shadow-elev-2 outline-none"
      style={{
        left: placement.left,
        top: placement.top,
        width: placement.width,
        height: placement.height,
        fontSize: placement.fontSize,
        lineHeight: node.lineHeight,
        fontFamily: family,
        fontWeight: node.fontWeight,
        fontStyle: node.italic ? 'italic' : 'normal',
        textAlign: node.align,
        color: node.color,
        letterSpacing: `${node.letterSpacing * scale}px`,
        transform: node.rotation === 0 ? undefined : `rotate(${node.rotation}deg)`,
        transformOrigin: 'center',
        caretColor: node.color,
      }}
      onChange={(event) => {
        const next = event.target.value.slice(0, 5_000);
        setValue(next);
        onPreview(next);
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          committedRef.current = true;
          onCancel();
          return;
        }
        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          commit();
        }
      }}
    />
  );
}
