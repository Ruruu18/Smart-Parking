import { useState, cloneElement, isValidElement } from 'react';
import BookingsReport from '../modal/BookingsReport';
import Payments from '../modal/Payments';

export default function ViewReports({ customTrigger }) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('bookings'); // 'bookings' | 'payments'

  return (
    <>
      {isValidElement(customTrigger) ? (
        cloneElement(customTrigger, {
          onClick: (e) => {
            customTrigger.props.onClick?.(e);
            setOpen(true);
          },
        })
      ) : (
        <button
          className="px-4 py-2 rounded-md bg-yellow-500 hover:bg-yellow-400 text-black font-semibold"
          onClick={() => setOpen(true)}
        >
          View Reports
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} />
          <div className="relative bg-gray-900 border border-gray-800 rounded-lg w-full max-w-6xl h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h2 className="text-lg font-semibold text-yellow-400">Reports</h2>
              <button
                className="text-gray-300 hover:text-white"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="p-4 overflow-auto grow space-y-4">
              <div className="flex items-center gap-2 border-b border-gray-800">
                <button
                  className={`px-3 py-2 text-sm font-medium rounded-t ${activeTab === 'bookings' ? 'bg-gray-800 text-yellow-400 border border-gray-800 border-b-gray-900' : 'text-gray-300 hover:text-white'}`}
                  onClick={() => setActiveTab('bookings')}
                >
                  Booking Reports
                </button>
                <button
                  className={`px-3 py-2 text-sm font-medium rounded-t ${activeTab === 'payments' ? 'bg-gray-800 text-yellow-400 border border-gray-800 border-b-gray-900' : 'text-gray-300 hover:text-white'}`}
                  onClick={() => setActiveTab('payments')}
                >
                  Payment Reports
                </button>
              </div>

              <div>
                {activeTab === 'bookings' ? <BookingsReport /> : <Payments />}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}