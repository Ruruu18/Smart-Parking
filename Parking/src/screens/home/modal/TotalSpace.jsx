import React from 'react';

const TotalSpace = ({ visible, onClose, parkingSpaces, onOccupiedSpaceClick }) => {
  if (!visible) return null; // nothing when hidden

  const handleSpaceClick = (space) => {
    if (space.is_occupied && onOccupiedSpaceClick) {
      onOccupiedSpaceClick(space);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-[90%] max-h-[60%] overflow-y-auto rounded-xl bg-gray-800 p-6 shadow-xl md:max-w-lg">
        <h2 className="mb-4 text-center text-xl font-semibold text-white">
          Parking Spaces
        </h2>

        <ul className="space-y-2">
          {parkingSpaces.map(space => (
            <li
              key={space.id}
              onClick={() => handleSpaceClick(space)}
              className={`flex items-center justify-between rounded-md px-4 py-2 transition-colors
                ${space.is_occupied
                  ? 'bg-red-600/20 text-red-300 cursor-pointer hover:bg-red-600/30'
                  : 'bg-green-600/20 text-green-300'}`}
              title={space.is_occupied ? 'Click to view details and check out' : ''}
            >
              <span className="font-semibold">{space.space_number}</span>
              <span>{space.is_occupied ? 'Occupied' : 'Available'}</span>
            </li>
          ))}
        </ul>

        <button
          onClick={onClose}
          className="mt-6 block rounded-md bg-blue-600 px-5 py-2 text-white hover:bg-blue-700"
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default TotalSpace;