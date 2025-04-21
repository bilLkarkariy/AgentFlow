import React from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

interface Props {
  from: string;
  to: string;
  onChangeFrom: (date: string) => void;
  onChangeTo: (date: string) => void;
  onApply: () => void;
}

const DateRangePicker: React.FC<Props> = ({ from, to, onChangeFrom, onChangeTo, onApply }) => {
  const handleFromChange = (date: Date | null) => {
    if (date) onChangeFrom(date.toISOString().slice(0, 10));
  };

  const handleToChange = (date: Date | null) => {
    if (date) onChangeTo(date.toISOString().slice(0, 10));
  };

  return (
    <div className="flex items-center space-x-2 mb-4">
      <div>
        <label htmlFor="from" className="sr-only">De</label>
        <DatePicker
          id="from"
          selected={new Date(from)}
          onChange={handleFromChange}
          dateFormat="yyyy-MM-dd"
          className="border border-neutral-300 px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>
      <div>
        <label htmlFor="to" className="sr-only">À</label>
        <DatePicker
          id="to"
          selected={new Date(to)}
          onChange={handleToChange}
          dateFormat="yyyy-MM-dd"
          className="border border-neutral-300 px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>
      <button
        onClick={onApply}
        className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-600"
      >
        Appliquer
      </button>
    </div>
  );
};

export default DateRangePicker;
