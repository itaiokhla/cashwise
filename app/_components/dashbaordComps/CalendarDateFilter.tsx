import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar, X } from 'lucide-react';

const CalendarDateFilter = ({ 
  uniqueDates, 
  selectedDate, 
  onDateSelect, 
  totalRecords,
  accountData 
}:any) => {

  const countExpenseEntriesForDate = (expenseDetails: any[], targetDate: string): number => {
    if (!Array.isArray(expenseDetails)) return 0;

    const validFields = [
      "cartage", "conveyance", "courier", "dailyWages", "food",
      "hotel", "labour", "loading", "maintenance", "other",
      "porter", "purchase", "rider", "tea", "transport",
    ];

    let totalCount = 0;

    for (const entry of expenseDetails) {
      // Check if this entry matches the target date
      if (entry.date === targetDate) {
        for (const field of validFields) {
          if (Array.isArray(entry[field]) && entry[field].length > 0) {
            totalCount += entry[field].length; // Count all entries in this field
          }
        }
      }
    }

    return totalCount;
  };

  // Alternative function to count unique expense categories for a specific date
  const countExpenseCategoriesForDate = (expenseDetails: any[], targetDate: string): number => {
    if (!Array.isArray(expenseDetails)) return 0;

    const validFields = [
      "cartage", "conveyance", "courier", "dailyWages", "food",
      "hotel", "labour", "loading", "maintenance", "other",
      "porter", "purchase", "rider", "tea", "transport",
    ];

    const nonEmptyFields = new Set<string>();

    for (const entry of expenseDetails) {
      // Check if this entry matches the target date
      if (entry.date === targetDate) {
        for (const field of validFields) {
          if (Array.isArray(entry[field]) && entry[field].length > 0) {
            nonEmptyFields.add(field);
          }
        }
      }
    }

    return nonEmptyFields.size;
  };

  console.log("CalendarDateFilter Props:",  accountData);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  
  // Convert date strings to Date objects for easier manipulation
  const availableDates = uniqueDates.map((dateStr:any) => new Date(dateStr));
  const dateCountMap: { [key: string]: number } = {};
  
  // Create a map of date counts
  uniqueDates.forEach((dateStr: any) => {
    // Choose one of these counting methods based on your needs:
    
    // Option 1: Count total number of expense entries for this date
    const count = countExpenseEntriesForDate(accountData?.expenseDetails, dateStr);
    
    // Option 2: Count number of expense categories that have data for this date
    // const count = countExpenseCategoriesForDate(accountData?.expenseDetails, dateStr);
    
    // Option 3: Count number of expense detail records for this date
    // const count = accountData?.expenseDetails?.filter((d: any) => d.date === dateStr).length || 0;

    dateCountMap[dateStr] = count;
  });

  // Get days in current month
  const getDaysInMonth = (date:any) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  };

  // Check if a date has expenses
  const hasExpenses = (date:any) => {
    if (!date) return false;
    // Use local date format to avoid timezone issues
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    return uniqueDates.includes(dateStr);
  };

  // Get expense count for a date
  const getExpenseCount = (date:any) => {
    if (!date) return 0;
    // Use local date format to avoid timezone issues
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    return dateCountMap[dateStr] || 0;
  };

  // Format date for display
  const formatDate = (date:any) => {
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // Handle date selection
  const handleDateClick = (date:any) => {
    if (!hasExpenses(date)) return;
    // Use local date format to avoid timezone issues
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    onDateSelect(dateStr);
    setIsCalendarOpen(false);
  };

  // Navigation functions
  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  // Check if date is selected
  const isSelected = (date:any) => {
    if (!date || !selectedDate) return false;
    // Use local date format to avoid timezone issues
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    return selectedDate === dateStr;
  };

  // Get current month name
  const getCurrentMonthName = () => {
    return currentMonth.toLocaleDateString('en-IN', {
      month: 'long',
      year: 'numeric'
    });
  };

  // Get months that have expenses for quick navigation
  const getMonthsWithExpenses = () => {
    const monthsSet = new Set();
    availableDates.forEach((date:any) => {
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
      monthsSet.add(monthKey);
    });
    
    return Array.from(monthsSet as Set<string>).map((monthKey: string) => {
      const [year, month] = monthKey.split('-');
      return new Date(parseInt(year), parseInt(month));
    }).sort((a:any, b:any) => b - a); // Sort in descending order (newest first)
  };

  const monthsWithExpenses = getMonthsWithExpenses();

  const days = getDaysInMonth(currentMonth);
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="mb-6">
      <div className="flex flex-wrap gap-2 items-center mb-4">
        <span className="font-medium text-gray-700">Filter by Date:</span>
        
        {/* All Dates Button */}
        <button
          onClick={() => onDateSelect('')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            selectedDate === ''
              ? 'bg-purple-500 text-white shadow-md'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          All Dates ({totalRecords})
        </button>

        {/* Calendar Toggle Button */}
        <button
          onClick={() => setIsCalendarOpen(!isCalendarOpen)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
            isCalendarOpen
              ? 'bg-purple-500 text-white shadow-md'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          <Calendar size={16} />
          {selectedDate ? `Selected: ${formatDate(new Date(selectedDate))}` : 'Select Date'}
        </button>

        {/* Clear Selection Button */}
        {selectedDate && (
          <button
            onClick={() => onDateSelect('')}
            className="px-3 py-2 rounded-lg text-sm bg-red-100 text-red-700 hover:bg-red-200 transition-colors flex items-center gap-1"
          >
            <X size={14} />
            Clear
          </button>
        )}
      </div>

      {/* Calendar Dropdown */}
      {isCalendarOpen && (
        <div className="bg-white border-2 border-gray-200 rounded-lg shadow-lg p-4 mt-2 max-w-md">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={goToPreviousMonth}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            
            <h3 className="text-lg font-semibold text-gray-800">
              {getCurrentMonthName()}
            </h3>
            
            <button
              onClick={goToNextMonth}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Quick Month Navigation */}
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-2">Quick jump to months with expenses:</p>
            <div className="flex flex-wrap gap-1">
              {monthsWithExpenses.slice(0, 6).map((month, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentMonth(month)}
                  className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-colors"
                >
                  {month.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                </button>
              ))}
            </div>
          </div>

          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {dayNames.map(day => (
              <div key={day} className="text-center text-xs font-medium text-gray-500 p-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((date, index) => {
              if (!date) {
                return <div key={index} className="p-2"></div>;
              }

              const hasData = hasExpenses(date);
              const expenseCount = getExpenseCount(date);
              const isDateSelected = isSelected(date);

              return (
                <button 
                  key={index}
                  onClick={() => handleDateClick(date)}
                  disabled={!hasData}
                  className={`
                    relative p-2 text-sm rounded-lg transition-all duration-200 min-h-[40px] flex flex-col items-center justify-center
                    ${hasData 
                      ? isDateSelected
                        ? 'bg-purple-500 text-white shadow-md transform scale-105'
                        : 'bg-green-100 text-green-800 hover:bg-green-200 hover:shadow-md cursor-pointer'
                      : 'text-gray-300 cursor-not-allowed'
                    }
                  `}
                >
                  <span className="font-medium">{date.getDate()}</span>
                  {hasData && (
                    <span className="text-xs opacity-75">
                      ({expenseCount})
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-4 pt-3 border-t border-gray-200">
            <div className="flex items-center gap-4 text-xs text-gray-600">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-green-100 rounded"></div>
                <span>Has expenses</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-purple-500 rounded"></div>
                <span>Selected</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-gray-200 rounded"></div>
                <span>No expenses</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Numbers in parentheses show total expense entries for that date
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarDateFilter;