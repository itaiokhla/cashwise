'use client';
import React, { useState, useEffect } from 'react';
import { Search, Loader2, MapPin, Calendar, User, CreditCard, FileText, DollarSign } from 'lucide-react';
import { useGetSearchQuery } from '@/app/_api_query/global.search.api';
import { usePathname } from 'next/navigation';



const getTypeIcon = (type: string) => {
  switch (type) {
    case 'user': return <User className="w-4 h-4" />;
    case 'toPayExpense': return <CreditCard className="w-4 h-4" />;
    case 'officeExpense': return <FileText className="w-4 h-4" />;
    case 'travelExpense': return <MapPin className="w-4 h-4" />;
    default: return <DollarSign className="w-4 h-4" />;
  }
};

const getTypeColor = (type: string) => {
  switch (type) {
    case 'user': return 'bg-purple-100 text-purple-800';
    case 'toPayExpense': return 'bg-red-100 text-red-800';
    case 'officeExpense': return 'bg-green-100 text-green-800';
    case 'travelExpense': return 'bg-purple-100 text-purple-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
};

const SearchResultItem: React.FC<any> = ({ item }) => {
  const renderItemContent = () => {
    switch (item.type) {
      case 'user':
        return (
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-gray-900">{item.name}</h3>
              {item.role && (
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                  {item.role}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 mb-1">{item.phone}</p>
            {/* <div className="flex gap-4 text-xs">
              <span className="text-green-600">
                Credit: {formatCurrency(item.totalCredit || 0)}
              </span>
              <span className="text-red-600">
                Debit: {formatCurrency(item.totalDebit || 0)}
              </span>
            </div> */}
            {item.matchedTransactions && item.matchedTransactions.length > 0 && (
              <div className="mt-1 text-xs text-gray-500">
                {item.matchedTransactions.length} matching transaction{item.matchedTransactions.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        );
      
      case 'toPayExpense':
      case 'travelExpense':
        return (
          <div className="flex-1 text-xs">
            <div className="flex items-center gap-2 mb-1 text-xs">
              <h3 className="font-semibold text-gray-900">{item?.createdBy?.name}</h3>
              {item?.createdBy?.role && (
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                  {item?.createdBy?.role}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-600 mb-1">{item?.createdBy?.phone}</p>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-gray-900">{item.siteName}</h3>
              {/* {item.date && (
                <span className="text-xs text-gray-500">
                  {new Date(item.date).toLocaleDateString('en-IN')}
                </span>
              )} */}
            </div>
            <p className="text-sm text-gray-600 mb-1">{item.todayWork}</p>
            <div className="flex justify-between items-center text-xs">
              {/* <span className="text-gray-500">
                {item.startingPlace} → {item.endingPlace} 
                {item.modeOfTravel && ` (${item.modeOfTravel})`}
              </span> */}
              {/* <span className="font-semibold text-green-600">
                {formatCurrency(item.amount || 0)}
              </span> */}
            </div>
            {item.matchedItems && item.matchedItems.length > 0 && (
              <div className="mt-1 text-xs text-gray-500">
                {item.matchedItems.length} matching item{item.matchedItems.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        );
      
      case 'officeExpense':
        return (
          <div className="flex-1">
             <div className="flex items-center gap-2 mb-1 text-xs">
              <h3 className="font-semibold text-gray-900">{item?.createdBy?.name}</h3>
              {item?.createdBy?.role && (
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                  {item?.createdBy?.role}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-600 mb-1">{item?.createdBy?.phone}</p>
           
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-gray-900">{item.shopName}</h3>
              {/* {item.date && (
                <span className="text-xs text-gray-500">
                  {new Date(item.date).toLocaleDateString('en-IN')}
                </span>
              )} */}
            </div>
            <p className="text-sm text-gray-600 mb-1">{item.itemName}</p>
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-500">
                {item.quantity && `Qty: ${item.quantity}`}
              </span>
              {/* <span className="font-semibold text-green-600">
                {formatCurrency(item.amount || 0)}
              </span> */}
            </div>
            {item.matchedItems && item.matchedItems.length > 0 && (
              <div className="mt-1 text-xs text-gray-500">
                {item.matchedItems.length} matching item{item.matchedItems.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        );
      
      default:
        return (
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">Unknown Type</h3>
            <p className="text-sm text-gray-600">Data available</p>
          </div>
        );
    }
  };

  return (
    <li className="p-4 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors">
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-full ${getTypeColor(item.type)}`}>
          {getTypeIcon(item.type)}
          
        </div>
        {renderItemContent()}
        <div className="flex flex-col items-center gap-1">
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${getTypeColor(item.type)}`}>
            {item.type.replace(/([A-Z])/g, ' $1').replace(/^./, (str:string) => str.toUpperCase())}
             </span>
            {item.date && (
                <span className="text-xs text-gray-500">
                  {new Date(item.date).toLocaleDateString('en-IN')}
                </span>
              )}
         
          {/* {item.score && (
            <span className="text-xs text-gray-400">
              Score: {item.score.toFixed(1)}
            </span>
          )} */}
        </div>
      </div>
    </li>
  );
};

// Public pages (shared report links) are opened by people outside CashWise;
// the internal search bar would only call protected APIs there.
const PUBLIC_PREFIXES = ['/shared-report'];

export default function Header() {
  const pathname = usePathname();
  if (PUBLIC_PREFIXES.some((p) => pathname?.startsWith(p))) return null;
  return <EnhancedGlobalSearch />;
}

function EnhancedGlobalSearch() {
  const [query, setQuery] = useState<string>('');
  const [debouncedQuery, setDebouncedQuery] = useState<string>('');
  const [isOpen, setIsOpen] = useState<boolean>(false);

  // Debounce query input
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedQuery(query), 400);
    return () => clearTimeout(handler);
  }, [query]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.search-container')) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // RTK Query hook with proper options
  const { data, isFetching, error, isError } = useGetSearchQuery(
    { q: debouncedQuery },
    { 
      skip: debouncedQuery.length < 2, // Skip query if less than 2 characters
      refetchOnMountOrArgChange: true, // Refetch when component mounts or args change
    }
  );
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setIsOpen(true);
  };

  const handleItemClick = (item: any) => {
    setIsOpen(false);
    setQuery('');
    
    // Handle navigation or action based on item type
    
    // You can add navigation logic here
    // For example:
    // switch (item.type) {
    //   case 'user':
    //     router.push(`/users/${item._id}`);
    //     break;
    //   case 'toPayExpense':
    //     router.push(`/expenses/to-pay/${item._id}`);
    //     break;
    //   case 'officeExpense':
    //     router.push(`/expenses/office/${item._id}`);
    //     break;
    //   case 'travelExpense':
    //     router.push(`/expenses/travel/${item._id}`);
    //     break;
    // }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setQuery('');
    }
  };

  return (
    <div className="relative bg-white p-4 w-full max-w-4xl mx-auto">
      <div className="search-container relative">
        {/* Search Input */}
        <div className="relative flex items-center justify-center">
          {/* <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-800 w-5 h-5" /> */}
          <input
            type="text"
            className="w-[70%] md:w-[30%] pl-1 pr-4 text-xs py-2 border border-gray-400 rounded-lg shadow-sm
                       focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none
                       bg-gray-50 hover:bg-white transition-colors text-gray-900 placeholder-gray-500"
            placeholder="Search..."
            value={query}
            onChange={handleInputChange}
            onFocus={() => debouncedQuery && setIsOpen(true)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
          />
        </div>

        {/* Dropdown Results */}
        {isOpen && debouncedQuery && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 
                          rounded-lg shadow-lg max-h-96 overflow-y-auto z-50">
            {isFetching && (
              <div className="p-6 flex items-center justify-center text-gray-500">
                <Loader2 className="animate-spin mr-2 w-5 h-5" />
                <span>Searching across all records...</span>
              </div>
            )}
            
            {isError && (
              <div className="p-4 text-red-600 text-center">
                <p>Error fetching results. Please try again.</p>
                {error && 'data' in error && (
                  <p className="text-sm mt-1">
                    {(error.data as any)?.message || 'An error occurred'}
                  </p>
                )}
              </div>
            )}
            
            {!isFetching && !isError && (!data?.results || data.results.length === 0) && (
              <div className="p-6 text-gray-500 text-center">
                <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No results found for &quot;{debouncedQuery}&quot;</p>
                <p className="text-sm mt-1">Try different keywords or check spelling</p>
              </div>
            )}
            
            {!isFetching && !isError && data?.results && data.results.length > 0 && (
              <>
                <div className="p-3 bg-gray-50 border-b border-gray-200">
                  <p className="text-sm text-gray-600">
                    Found {data.totalFound || data.results.length} result{(data.totalFound || data.results.length) !== 1 ? 's' : ''} for &quot;{data.query || debouncedQuery}&quot;
                  </p>
                </div>
                <ul className="max-h-80 overflow-y-auto">
                  {data.results.map((item:any, idx:number) => (
                    <div key={item._id || idx} onClick={() => handleItemClick(item)}>
                      <SearchResultItem item={item} />
                    </div>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}