const WHR = require('../../models/WHR.js');
const Loan = require('../../models/Loan.js');

async function listWhrs(farmerId) {
  return WHR.find({ farmerId });
}

async function createLoan({ whrId, farmerId }) {
  const whr = await WHR.findOne({ _id: whrId, farmerId });
  if (!whr) throw new Error('WHR not found');
  const amount = Math.floor(whr.financialDetails.estimatedValue * 0.7);
  const loan = await Loan.create({
    farmerId,
    whrId,
    principal: amount,
    interestRate: 0.12,
    status: 'approved'
  });
  whr.status = 'locked_for_loan';
  whr.loanDetails = { isCollateral: true, loanId: loan._id, lockedDate: new Date() };
  await whr.save();
  return loan;
}

module.exports = { listWhrs, createLoan };
