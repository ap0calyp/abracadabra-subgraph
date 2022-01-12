import { BigDecimal, BigInt } from '@graphprotocol/graph-ts'
import {
  cauldron as cauldronContract,
  LogAccrue,
  LogBorrow,
  LogExchangeRate,
  LogRemoveCollateral,
  LogRepay,
  LogWithdrawFees,
} from '../generated/cauldron/cauldron'
import { CauldronFee, ExchangeRate, UserLiquidation } from '../generated/schema'
import { LogDeploy } from '../generated/degenbox/degenbox'
import { Address } from '@graphprotocol/graph-ts/common/numbers'
import { cauldron } from '../generated/templates'
import { erc20 } from '../generated/templates/StandardToken/erc20'
import { cauldronMediumRiskV1 } from '../generated/templates/cauldron/cauldronMediumRiskV1'

const EIGHTEEN_DECIMALS = BigInt.fromI32(10).pow(18).toBigDecimal()

function getCauldronFee(address: Address): CauldronFee {
  let entity = CauldronFee.load(address.toHex())
  if (!entity) {
    entity = new CauldronFee(address.toHex())
    entity.totalBorrowElastic = BigDecimal.zero()
    entity.accrueInfoFeesEarned = BigDecimal.zero()
    entity.accrueInfoFeesWithdrawn = BigDecimal.zero()
    let cauldron = cauldronContract.bind(address)
    entity.masterContract = cauldron.masterContract().toHex()
    entity.bentoBox = cauldron.bentoBox().toHex()
    let token = erc20.bind(cauldron.collateral())
    entity.symbol = token.symbol()
  }
  return entity
}

function getUserLiquidation(user: string, txHash: string): UserLiquidation {
  let id = user + '-' + txHash
  let userLiquidation = UserLiquidation.load(id)
  if (!userLiquidation) {
    userLiquidation = new UserLiquidation(id)
    userLiquidation.user = user
    userLiquidation.transaction = txHash
    userLiquidation.collateralRemoved = BigDecimal.zero()
    userLiquidation.loanRepaid = BigDecimal.zero()
  }
  return userLiquidation
}

function getExchangeRate(cauldron: string): ExchangeRate {
  let exchangeRate = ExchangeRate.load(cauldron)
  if (!exchangeRate) {
    exchangeRate = new ExchangeRate(cauldron)
  }
  return exchangeRate
}


export function handleLogAccrue(event: LogAccrue): void {
  let cauldronFee = getCauldronFee(event.address)
  let eventAccruedAmount = event.params.accruedAmount.divDecimal(EIGHTEEN_DECIMALS)
  cauldronFee.accrueInfoFeesEarned = cauldronFee.accrueInfoFeesEarned.plus(eventAccruedAmount)
  cauldronFee.totalBorrowElastic = cauldronFee.totalBorrowElastic.plus(eventAccruedAmount)
  cauldronFee.save()
}

export function handleLogBorrow(event: LogBorrow): void {
  let cauldronFee = getCauldronFee(event.address)
  let eventBorrowedAmount = event.params.amount.divDecimal(EIGHTEEN_DECIMALS)
  cauldronFee.totalBorrowElastic = cauldronFee.totalBorrowElastic.plus(eventBorrowedAmount)

  // oldCauldrons have only 2 pieces of data in accrueInfo, new cauldrons have 3
  let oldCauldrons = [
      '0x469a991a6bb8cbbfee42e7ab846edeef1bc0b3d3'.toUpperCase(),// CauldronLowRiskV1
      '0x4a9cb5d0b755275fd188f87c0a8df531b0c7c7d2'.toUpperCase(),// CauldronMediumRiskV1
  ]
  // Borrowing while loan is active sort of throws this off and I can't figure out why.  So I take the direct value from contract
  //  if this feeAmount was a separate variable then I could track the fee independently of the amount
  //   emit LogBorrow(msg.sender, to, amount.add(feeAmount), part);
  //
  if (oldCauldrons.indexOf(cauldronFee.masterContract.toUpperCase()) > -1) {
    let deployedCauldron = cauldronMediumRiskV1.bind(event.address)
    cauldronFee.accrueInfoFeesEarned = deployedCauldron.accrueInfo().value1.toBigDecimal().div(EIGHTEEN_DECIMALS)
  } else {
    let deployedCauldron = cauldronContract.bind(event.address)
    cauldronFee.accrueInfoFeesEarned = deployedCauldron.accrueInfo().value1.toBigDecimal().div(EIGHTEEN_DECIMALS)
  }
  cauldronFee.save()
}

export function handleLogRepay(event: LogRepay): void {
  let cauldronFee = getCauldronFee(event.address)
  let eventRepayPart = event.params.amount.divDecimal(EIGHTEEN_DECIMALS)
  cauldronFee.totalBorrowElastic = cauldronFee.totalBorrowElastic.minus(eventRepayPart)
  cauldronFee.save()

  // liquidation handler
  let invoker = event.transaction.from.toHex().toLowerCase()
  let user = event.params.to.toHex().toLowerCase()
  if (invoker != user) {
    let txHash = event.transaction.hash.toHex()
    let userLiquidation = getUserLiquidation(user, txHash)
    let exchangeRate = getExchangeRate(event.address.toHex())
    userLiquidation.timestamp = event.block.timestamp
    userLiquidation.loanRepaid = event.params.amount.divDecimal(EIGHTEEN_DECIMALS)
    userLiquidation.exchangeRate = exchangeRate.rate
    userLiquidation.save()
  }
}

export function handleLogWithdrawFees(event: LogWithdrawFees): void {
  let cauldronFee = getCauldronFee(event.address)
  let eventWithdrawFeePart = event.params.feesEarnedFraction.divDecimal(EIGHTEEN_DECIMALS)
  cauldronFee.accrueInfoFeesWithdrawn = cauldronFee.accrueInfoFeesWithdrawn.plus(eventWithdrawFeePart)
  cauldronFee.accrueInfoFeesEarned = BigDecimal.zero()
  cauldronFee.save()
}

export function handleLogRemoveCollateral(event: LogRemoveCollateral): void {
  let invoker = event.transaction.from.toHex().toLowerCase()
  let user = event.params.from.toHex().toLowerCase()
  if (invoker != user) {
    let txHash = event.transaction.hash.toHex()
    let userLiquidation = getUserLiquidation(user, txHash)
    userLiquidation.collateralRemoved = event.params.share.divDecimal(EIGHTEEN_DECIMALS)
    userLiquidation.cauldron = event.address.toHex()
    userLiquidation.save()
  }
}

export function handleLogExchangeRate(event: LogExchangeRate): void {
  let cauldron = event.address.toHex()
  let exchangeRate = getExchangeRate(cauldron)
  exchangeRate.rate = event.params.rate.divDecimal(EIGHTEEN_DECIMALS)
  exchangeRate.save()
}


// watching bento box for master contract deployments
export function handleLogDeploy(event: LogDeploy): void {
  let masterContracts = [
      '0x63905bb681b9e68682f392df2b22b7170f78d300'.toUpperCase(), // CauldronV2Flat
      '0x476b1E35DDE474cB9Aa1f6B85c9Cc589BFa85c1F'.toUpperCase(), // CauldronV2
      '0x1df188958a8674b5177f77667b8d173c3cdd9e51'.toUpperCase(), // CauldronV2CheckpointV1
      '0x4a9cb5d0b755275fd188f87c0a8df531b0c7c7d2'.toUpperCase(), // CauldronMediumRiskV1
      '0x469a991a6bb8cbbfee42e7ab846edeef1bc0b3d3'.toUpperCase(), // CauldronLowRiskV1
  ]
  if (masterContracts.indexOf(event.params.masterContract.toHex().toUpperCase()) > -1) {
    cauldron.create(event.params.cloneAddress)
  }
}
