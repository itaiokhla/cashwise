import mongoose from 'mongoose';

export interface Expense {
  _id?: mongoose.Types.ObjectId; // Optional field for the document ID
  siteName: string;               // Name of the site
  siteLocation: string;           // Location of the site
  date: Date;                     // Date of the expense
  advancedReceived: number;       // Amount of advanced received
  todayWork: string;              // Description of today's work
  isBase64?: boolean;             // Optional flag indicating if the data is in Base64 format

  conveyance: {
    amount: number;               // Amount for conveyance
    description: string;          // Description of the conveyance
    url: string;                  // URL related to the conveyance
  };
  
  conveyance2: {
    amount: number;               // Amount for the second conveyance
    description: string;          // Description of the second conveyance
    url: string;                  // URL related to the second conveyance
  };
  
  purchase: {
    amount: number;               // Amount for purchases
    description: string;          // Description of the purchase
    url: string;                  // URL related to the purchase
  };
  purchase2: {
    amount: number;               // Amount for purchases
    description: string;          // Description of the purchase
    url: string;                  // URL related to the purchase
  };
  
  foodExpense: {
    amount: number;               // Amount for food expenses
    description: string;          // Description of the food expense
    url: string;                  // URL related to the food expense
  };
  
  labour: {
    labourNumber: number;         // Number of labours (added this field to match the schema)
    amount: number;               // Amount for labour
    description: string;          // Description of the labour
    url: string;                  // URL related to the labour
  };
  
  teaFood: {
    amount: number;               // Amount for tea food
    description: string;          // Description of the tea food
    url: string;                  // URL related to the tea food
  };
  
  otherExpense: {
    amount: number;               // Amount for other expenses
    description: string;          // Description of the other expense
    url: string;                  // URL related to the other expense
  };
  
  fuel: {
    rate: number;                 // Rate for fuel
    amount: number;               // Amount for fuel
    distance: number;             // Distance for fuel
    firsturl: string;             // First URL related to fuel
    lasturl: string;              // Last URL related to fuel
    total: number;                // Total for fuel
  };
  
  hotel: {
    amount: number;               // Amount for hotel expenses
    description: string;          // Description of the hotel expense
    url: string;                  // URL related to the hotel expense
  };
  
  createdBy: mongoose.Types.ObjectId; // ID of the user who created the expense
}