import { BigDecimal, BigInt } from '@graphprotocol/graph-ts'
import { Address } from '@graphprotocol/graph-ts/common/numbers'
import {
  cauldron as cauldronContract,
  LogAccrue,
  LogBorrow,
  LogExchangeRate,
  LogRemoveCollateral,
  LogRepay,
  LogWithdrawFees,
} from '../generated/templates/cauldron/cauldron'
import {
  degenbox
} from '../generated/degenbox/degenbox'
import { CauldronFee, ExchangeRate, UserLiquidation } from '../generated/schema'
import { erc20 } from '../generated/templates/cauldron/erc20'
import { cauldronMediumRiskV1 } from '../generated/templates/cauldron/cauldronMediumRiskV1'

const LIQUIDATE_SIGNATURES = [
    '0x912860c5' // liquidate(address[],uint256[],address,address)
]

function decimals(exp: number): BigDecimal {
  return BigInt.fromI32(10).pow(u8(exp)).toBigDecimal()
}

const EIGHTEEN_DECIMALS = BigInt.fromI32(10).pow(18).toBigDecimal()

function getCauldronFee(address: Address): CauldronFee {
  let entity = CauldronFee.load(address.toHex())
  if (!entity) {
    entity = new CauldronFee(address.toHex())
    entity.totalBorrowElastic = BigDecimal.zero()
    entity.accrueInfoFeesEarned = BigDecimal.zero()
    entity.accrueInfoFeesWithdrawn = BigDecimal.zero()
    const cauldron = cauldronContract.bind(address)
    entity.masterContract = cauldron.masterContract().toHex()
    entity.bentoBox = cauldron.bentoBox().toHex()
    const token = erc20.bind(cauldron.collateral())
    entity.collateralSymbol = token.symbol()
    entity.collateralName = token.name()
  }
  return entity
}

function getUserLiquidation(user: string, txHash: string): UserLiquidation {
  const id = user + '-' + txHash
  let userLiquidation = UserLiquidation.load(id)
  if (!userLiquidation) {
    userLiquidation = new UserLiquidation(id)
    userLiquidation.user = user
    userLiquidation.transaction = txHash
    userLiquidation.collateralRemoved = BigDecimal.zero()
    userLiquidation.loanRepaid = BigDecimal.zero()
    userLiquidation.direct = false
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
  const cauldronFee = getCauldronFee(event.address)
  const eventAccruedAmount = event.params.accruedAmount.divDecimal(EIGHTEEN_DECIMALS)
  cauldronFee.accrueInfoFeesEarned = cauldronFee.accrueInfoFeesEarned.plus(eventAccruedAmount)
  cauldronFee.totalBorrowElastic = cauldronFee.totalBorrowElastic.plus(eventAccruedAmount)
  cauldronFee.save()
}

export function handleLogBorrow(event: LogBorrow): void {
  const cauldronFee = getCauldronFee(event.address)
  const eventBorrowedAmount = event.params.amount.divDecimal(EIGHTEEN_DECIMALS)
  cauldronFee.totalBorrowElastic = cauldronFee.totalBorrowElastic.plus(eventBorrowedAmount)

  // oldCauldrons have only 2 pieces of data in accrueInfo, new cauldrons have 3
  const oldCauldrons = [
      '0x469a991a6bb8cbbfee42e7ab846edeef1bc0b3d3'.toUpperCase(),// CauldronLowRiskV1
      '0x4a9cb5d0b755275fd188f87c0a8df531b0c7c7d2'.toUpperCase(),// CauldronMediumRiskV1
      '0x4c56DbCC056655b8813539aF9C819ae128c07e17'.toUpperCase() // CauldronMediumRiskV1
  ]
  // Borrowing while loan is active sort of throws this off and I can't figure out why.  So I take the direct value from contract
  //  if this feeAmount was a separate variable then I could track the fee independently of the amount
  //   emit LogBorrow(msg.sender, to, amount.add(feeAmount), part);
  //
  if (oldCauldrons.indexOf(cauldronFee.masterContract.toUpperCase()) > -1) {
    const deployedCauldron = cauldronMediumRiskV1.bind(event.address)
    cauldronFee.accrueInfoFeesEarned = deployedCauldron.accrueInfo().value1.toBigDecimal().div(EIGHTEEN_DECIMALS)
  } else {
    const deployedCauldron = cauldronContract.bind(event.address)
    cauldronFee.accrueInfoFeesEarned = deployedCauldron.accrueInfo().value1.toBigDecimal().div(EIGHTEEN_DECIMALS)
  }
  cauldronFee.save()
}

export function handleLogRepay(event: LogRepay): void {
  const cauldronFee = getCauldronFee(event.address)
  const eventRepayPart = event.params.amount.divDecimal(EIGHTEEN_DECIMALS)
  cauldronFee.totalBorrowElastic = cauldronFee.totalBorrowElastic.minus(eventRepayPart)
  cauldronFee.save()

  // liquidation handler
  const invoker = event.transaction.from.toHex().toLowerCase()
  const user = event.params.to.toHex().toLowerCase()
  if (invoker != user) {
    const txHash = event.transaction.hash.toHex()
    const userLiquidation = getUserLiquidation(user, txHash)
    const exchangeRate = getExchangeRate(event.address.toHex())
    userLiquidation.direct = LIQUIDATE_SIGNATURES[0] == event.transaction.input.toHex().slice(0, 10).toLowerCase()
    userLiquidation.timestamp = event.block.timestamp
    userLiquidation.loanRepaid = event.params.amount.divDecimal(EIGHTEEN_DECIMALS)
    userLiquidation.exchangeRate = exchangeRate.rate
    userLiquidation.save()
  }
}

export function handleLogWithdrawFees(event: LogWithdrawFees): void {
  const cauldronFee = getCauldronFee(event.address)
  const eventWithdrawFeePart = event.params.feesEarnedFraction.divDecimal(EIGHTEEN_DECIMALS)
  cauldronFee.accrueInfoFeesWithdrawn = cauldronFee.accrueInfoFeesWithdrawn.plus(eventWithdrawFeePart)
  cauldronFee.accrueInfoFeesEarned = BigDecimal.zero()
  cauldronFee.save()
}

export function handleLogRemoveCollateral(event: LogRemoveCollateral): void {
  const invoker = event.transaction.from.toHex().toLowerCase()
  const user = event.params.from.toHex().toLowerCase()
  if (invoker != user) {
    const txHash = event.transaction.hash.toHex()
    const userLiquidation = getUserLiquidation(user, txHash)
    const deployedCauldron = cauldronContract.bind(event.address)
    const collateral = deployedCauldron.collateral()
    const deployedErc = erc20.bind(collateral)
    const collateralRemoved = degenbox.bind(deployedCauldron.bentoBox())
        .toAmount(collateral, event.params.share, false)
        .divDecimal(decimals(deployedErc.decimals()))
    userLiquidation.cauldron = event.address.toHex()
    userLiquidation.collateralRemoved = collateralRemoved
    userLiquidation.save()
  }
}

export function handleLogExchangeRate(event: LogExchangeRate): void {
  const cauldron = event.address.toHex()
  const exchangeRate = getExchangeRate(cauldron)
  exchangeRate.rate = event.params.rate.divDecimal(EIGHTEEN_DECIMALS)
  exchangeRate.save()
}
