import { useState } from 'react';
import { RgbaColorPicker } from 'react-colorful';
import type { RGBAColor } from '@/types';

interface ColorPickerProps {
  color: RGBAColor | null;
  onChange: (color: RGBAColor | null) => void;
  allowTransparent?: boolean;
}

export default function ColorPicker({
  color,
  onChange,
  allowTransparent = true,
}: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [useTransparent, setUseTransparent] = useState(color === null);

  const handleColorChange = (newColor: { r: number; g: number; b: number; a: number }) => {
    onChange({
      red: newColor.r,
      green: newColor.g,
      blue: newColor.b,
      alpha: newColor.a,
    });
  };

  const toggleTransparent = () => {
    if (useTransparent) {
      setUseTransparent(false);
      onChange({ red: 255, green: 255, blue: 255, alpha: 1 });
    } else {
      setUseTransparent(true);
      onChange(null);
    }
  };

  const colorStyle = color
    ? `rgba(${color.red}, ${color.green}, ${color.blue}, ${color.alpha})`
    : 'transparent';

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-2 border rounded hover:bg-gray-50"
        >
          <div
            className="w-6 h-6 rounded border border-gray-300"
            style={{
              backgroundColor: colorStyle,
              backgroundImage: color === null 
                ? 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)'
                : undefined,
              backgroundSize: '8px 8px',
              backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px',
            }}
          />
          <span className="text-sm">
            {color ? `RGB(${color.red}, ${color.green}, ${color.blue})` : 'Transparent'}
          </span>
        </button>

        {allowTransparent && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={useTransparent}
              onChange={toggleTransparent}
              className="rounded"
            />
            Transparent
          </label>
        )}
      </div>

      {isOpen && !useTransparent && (
        <div className="p-2 border rounded bg-white shadow-lg inline-block">
          <RgbaColorPicker
            color={color ? { r: color.red, g: color.green, b: color.blue, a: color.alpha } : { r: 255, g: 255, b: 255, a: 1 }}
            onChange={handleColorChange}
          />
        </div>
      )}
    </div>
  );
}
