import TransactionDetails from '../(pages)/account/transactiondetails/[userId]/page';

interface TransactionInterface{
    _id: string | null;
    createdAt: Date | null;
    updatedAt: Date | null;
    amount: number | null;
    files: File[] | [];
    reason: string;
    remarks:string;
    description:string;

}

export interface CreditFormInterface {
    _id: string | null;
  fromName: string;
  fromEmail: string;
  fromPhone: number | null;
  toName: string;
  toEmail: string;
  toPhone: number | null;
  ledgerType:string;
  transactionDetails:TransactionInterface[];
}
