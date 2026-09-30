// app/api/search/route.ts
'use server';

import DB from "@app/_database/db";
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import ToPayExpense from "@app/_model/toPay.modal";
import OfficeExpense from "@app/_model/office.modal";
import TravelExpense from "@app/_model/travel.modal";
import Users from "@app/_model/user.model";

// Ensure DB connection
(async function initializeDB() {
  await DB();
})();

interface SearchResult {
  type: string;
  score: number;
  [key: string]: any;
}

// Helper function to calculate search relevance score
function calculateScore(item: any, query: string): number {
  const queryLower = query.toLowerCase();
  let score = 0;
  
  // Convert item to string for searching (handle nested objects better)
  const itemString = JSON.stringify(item, (key, value) => {
    // Convert numbers to strings for searching
    if (typeof value === 'number') {
      return value.toString();
    }
    return value;
  }).toLowerCase();
  
  // Exact matches get highest score
  if (itemString.includes(queryLower)) {
    score += 10;
  }
  
  // Word matches
  const queryWords = queryLower.split(' ').filter(word => word.length > 0);
  queryWords.forEach(word => {
    if (itemString.includes(word)) {
      score += 5;
    }
  });
  
  return score;
}

// Helper function to check if a value matches the search query
function isMatch(value: any, query: string): boolean {
  if (!value) return false;
  
  const queryLower = query.toLowerCase();
  const valueString = String(value).toLowerCase();
  
  // Check for exact match or partial match
  return valueString.includes(queryLower);
}

// Helper function to search in nested expense arrays
function searchInExpenseCategories(expenses: any[], query: string, expenseType: string) {
  const results: SearchResult[] = [];
  
  expenses.forEach(expense => {
    let hasMatch = false;
    let matchedItems: any[] = [];
    let expenseScore = 0;
    
    // First check if the main expense fields match
    const mainFields = ['date', 'createdBy'];
    mainFields.forEach(field => {
      if (expense[field] && isMatch(expense[field], query)) {
        hasMatch = true;
        expenseScore += 3;
      }
    });
    
    // Search in all expense categories
    const categories = [
      'conveyance', 'food', 'tea', 'purchase', 'hotel', 'labour', 
      'loading', 'maintenance', 'other', 'porter', 'courier', 
      'cartage', 'rider', 'transport', 'dailyWages'
    ];
    
    categories.forEach(category => {
      if (expense[category] && Array.isArray(expense[category])) {
        expense[category].forEach((item: any, index: number) => {
          let itemMatches = false;
          let itemScore = 0;
          
          // Check all possible fields in the item
          Object.keys(item).forEach(key => {
            if (key === '_id' || key === 'createdAt' || key === 'updatedAt') {
              return; // Skip these fields
            }
            
            const value = item[key];
            if (value !== null && value !== undefined && isMatch(value, query)) {
              itemMatches = true;
              itemScore += 2;
              
              // Give higher score for amount matches (common search)
              if (key === 'amount' || key === 'money') {
                itemScore += 5;
              }
              
              // Give higher score for text field matches
              if (typeof value === 'string' && value.toLowerCase().includes(query.toLowerCase())) {
                itemScore += 3;
              }
            }
          });
          
          if (itemMatches) {
            hasMatch = true;
            expenseScore += itemScore;
            matchedItems.push({
              ...item,
              category,
              parentDate: expense.date,
              itemIndex: index
            });
          }
        });
      }
    });
    
    if (hasMatch) {
      results.push({
        ...expense,
        type: expenseType,
        matchedItems,
        score: expenseScore + calculateScore(expense, query)
      });
    }
  });
  
  return results;
}

// Helper function to search in user credit/debit transactions
function searchInUserTransactions(users: any[], query: string) {
  const results: SearchResult[] = [];
  
  users.forEach(user => {
    let hasMatch = false;
    let matchedTransactions: any[] = [];
    let userScore = 0;
    
    // Check user basic info
    const userFields = ['name', 'email', 'phone', 'role', 'type'];
    userFields.forEach(field => {
      if (user[field] && isMatch(user[field], query)) {
        hasMatch = true;
        userScore += 5;
      }
    });
    
    // Search in credit transactions
    if (user.credit && Array.isArray(user.credit)) {
      user.credit.forEach((creditEntry: any) => {
        // Check credit entry fields
        ['name', 'email', 'phone'].forEach(field => {
          if (creditEntry[field] && isMatch(creditEntry[field], query)) {
            hasMatch = true;
            userScore += 3;
          }
        });
        
        // Check transaction details
        if (creditEntry.transactionDetails && Array.isArray(creditEntry.transactionDetails)) {
          creditEntry.transactionDetails.forEach((transaction: any) => {
            let transactionMatches = false;
            let transactionScore = 0;
            
            Object.keys(transaction).forEach(key => {
              if (key === '_id' || key === 'createdAt' || key === 'updatedAt') {
                return;
              }
              
              const value = transaction[key];
              if (value !== null && value !== undefined && isMatch(value, query)) {
                transactionMatches = true;
                transactionScore += 2;
                
                if (key === 'money') {
                  transactionScore += 5; // Higher score for money matches
                }
              }
            });
            
            if (transactionMatches) {
              hasMatch = true;
              userScore += transactionScore;
              matchedTransactions.push({
                ...transaction,
                type: 'credit',
                contactName: creditEntry.name,
                contactEmail: creditEntry.email,
                contactPhone: creditEntry.phone
              });
            }
          });
        }
      });
    }
    
    // Search in debit transactions
    if (user.debit && Array.isArray(user.debit)) {
      user.debit.forEach((debitEntry: any) => {
        // Check debit entry fields
        ['name', 'email', 'phone'].forEach(field => {
          if (debitEntry[field] && isMatch(debitEntry[field], query)) {
            hasMatch = true;
            userScore += 3;
          }
        });
        
        // Check transaction details
        if (debitEntry.transactionDetails && Array.isArray(debitEntry.transactionDetails)) {
          debitEntry.transactionDetails.forEach((transaction: any) => {
            let transactionMatches = false;
            let transactionScore = 0;
            
            Object.keys(transaction).forEach(key => {
              if (key === '_id' || key === 'createdAt' || key === 'updatedAt') {
                return;
              }
              
              const value = transaction[key];
              if (value !== null && value !== undefined && isMatch(value, query)) {
                transactionMatches = true;
                transactionScore += 2;
                
                if (key === 'money') {
                  transactionScore += 5; // Higher score for money matches
                }
              }
            });
            
            if (transactionMatches) {
              hasMatch = true;
              userScore += transactionScore;
              matchedTransactions.push({
                ...transaction,
                type: 'debit',
                contactName: debitEntry.name,
                contactEmail: debitEntry.email,
                contactPhone: debitEntry.phone
              });
            }
          });
        }
      });
    }
    
    if (hasMatch) {
      // Calculate totals
      const totalCredit = user.credit?.reduce((sum: number, creditEntry: any) => {
        return sum + (creditEntry.transactionDetails?.reduce((entrySum: number, transaction: any) => {
          return entrySum + (transaction.money || 0);
        }, 0) || 0);
      }, 0) || 0;
      
      const totalDebit = user.debit?.reduce((sum: number, debitEntry: any) => {
        return sum + (debitEntry.transactionDetails?.reduce((entrySum: number, transaction: any) => {
          return entrySum + (transaction.money || 0);
        }, 0) || 0);
      }, 0) || 0;
      
      results.push({
        ...user,
        type: 'user',
        matchedTransactions,
        totalCredit,
        totalDebit,
        balance: totalCredit - totalDebit,
        score: userScore + calculateScore(user, query)
      });
    }
  });
  
  return results;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();
    
    if (!q || q.length < 1) { // Reduced minimum length to 1
      return NextResponse.json({ results: [] }, { status: 200 });
    }

    console.log(`Searching for: "${q}"`);

    // Parallel searches across all collections with better error handling
    const [toPayExpenses, officeExpenses, travelExpenses, users] = await Promise.all([
      ToPayExpense.find({}).populate({
              path: "createdBy",
              model: Users,
              select: "_id name phone role",
            }).limit(100).lean().catch(err => {
        console.error('Error fetching ToPayExpenses:', err);
        return [];
      }),
      OfficeExpense.find({}).populate({
                    path: "createdBy",
                    model: Users,
                    select: "_id name phone role",
                  }).limit(100).lean().catch(err => {
        console.error('Error fetching OfficeExpenses:', err);
        return [];
      }),
      TravelExpense.find({}).populate({
                    path: "createdBy",
                    model: Users,
                    select: "_id name phone role",
                  }).limit(100).lean().catch(err => {
        console.error('Error fetching TravelExpenses:', err);
        return [];
      }),
      Users.find({}).limit(50).lean().catch(err => {
        console.error('Error fetching Users:', err);
        return [];
      })
    ]);

    console.log(`Found ${toPayExpenses.length} toPay, ${officeExpenses.length} office, ${travelExpenses.length} travel expenses, ${users.length} users`);

    // Search in each collection type
    const toPayResults = searchInExpenseCategories(toPayExpenses, q, 'toPayExpense');
    const officeResults = searchInExpenseCategories(officeExpenses, q, 'officeExpense');  
    const travelResults = searchInExpenseCategories(travelExpenses, q, 'travelExpense');
    const userResults = searchInUserTransactions(users, q);

    console.log(`Search results: toPay=${toPayResults.length}, office=${officeResults.length}, travel=${travelResults.length}, users=${userResults.length}`);

    // Combine all results
    let allResults: SearchResult[] = [
      ...toPayResults,
      ...officeResults,
      ...travelResults, 
      ...userResults
    ];

    // Sort by relevance score (descending)
    allResults.sort((a, b) => b.score - a.score);
    
    // Limit results to prevent overwhelming the UI
    allResults = allResults.slice(0, 50); // Increased limit for testing
    
    console.log(`Final results: ${allResults.length} items`);

    return NextResponse.json({ 
      results: allResults,
      query: q,
      totalFound: allResults.length,
      debug: {
        toPayCount: toPayResults.length,
        officeCount: officeResults.length,
        travelCount: travelResults.length,
        userCount: userResults.length
      }
    }, { status: 200 });

  } catch (error: any) {
    console.error("Search error:", error);
    return NextResponse.json({
      type: "ERROR", 
      message: "Search failed. Please try again.",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}

// Optional: Add a POST endpoint for advanced searches
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      query,
      type, // 'expense', 'user', 'credit', 'debit'
      dateFrom,
      dateTo,
      amountMin,
      amountMax,
      category // 'conveyance', 'food', etc.
    } = body;

    if (!query || query.length < 1) {
      return NextResponse.json({ results: [] }, { status: 200 });
    }

    // Build advanced search filters
    const dateFilter = dateFrom && dateTo ? {
      date: {
        $gte: new Date(dateFrom),
        $lte: new Date(dateTo)
      }
    } : {};

    // For amount filtering, we need to search within the nested arrays
    // This is more complex and might need aggregation pipeline for better performance

    // Execute advanced search based on type filter
    let results: SearchResult[] = [];
    
    if (!type || type === 'expense') {
      const [toPayExpenses, officeExpenses, travelExpenses] = await Promise.all([
        ToPayExpense.find(dateFilter).limit(50).lean().catch(() => []),
        OfficeExpense.find(dateFilter).limit(50).lean().catch(() => []),
        TravelExpense.find(dateFilter).limit(50).lean().catch(() => [])
      ]);
      
      results = [
        ...searchInExpenseCategories(toPayExpenses, query, 'toPayExpense'),
        ...searchInExpenseCategories(officeExpenses, query, 'officeExpense'),
        ...searchInExpenseCategories(travelExpenses, query, 'travelExpense')
      ];
      
      // Apply amount filtering to results if specified
      if (amountMin !== undefined || amountMax !== undefined) {
        results = results.filter(result => {
          if (!result.matchedItems || result.matchedItems.length === 0) return false;
          
          return result.matchedItems.some((item: any) => {
            const amount = item.amount || item.money || 0;
            const min = amountMin !== undefined ? amountMin : 0;
            const max = amountMax !== undefined ? amountMax : Infinity;
            return amount >= min && amount <= max;
          });
        });
      }
    }
    
    if (!type || type === 'user') {
      const users = await Users.find({}).limit(50).lean().catch(() => []);
      const userResults = searchInUserTransactions(users, query);
      
      // Apply amount filtering to user transactions if specified
      if (amountMin !== undefined || amountMax !== undefined) {
        const filteredUserResults = userResults.filter(result => {
          if (!result.matchedTransactions || result.matchedTransactions.length === 0) return false;
          
          return result.matchedTransactions.some((transaction: any) => {
            const amount = transaction.money || 0;
            const min = amountMin !== undefined ? amountMin : 0;
            const max = amountMax !== undefined ? amountMax : Infinity;
            return amount >= min && amount <= max;
          });
        });
        results = [...results, ...filteredUserResults];
      } else {
        results = [...results, ...userResults];
      }
    }

    // Sort by relevance
    results.sort((a, b) => b.score - a.score);
    
    return NextResponse.json({
      results: results.slice(0, 50),
      query,
      filters: { type, dateFrom, dateTo, amountMin, amountMax, category },
      totalFound: results.length
    }, { status: 200 });

  } catch (error: any) {
    console.error("Advanced search error:", error);
    return NextResponse.json({
      type: "ERROR",
      message: "Advanced search failed. Please try again.",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 });
  }
}