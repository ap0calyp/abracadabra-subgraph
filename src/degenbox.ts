import { LogDeploy } from '../generated/degenbox/degenbox'
import { cauldron } from '../generated/templates'

// watching bento box for master contract deployments

export function handleLogDeployMainnet(event: LogDeploy): void {
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

export function handleLogDeployFantom(event: LogDeploy): void {
    let masterContracts = [
        '0xe802823719f9d2520415854e6f95bae498ff1d52'.toUpperCase(), // CauldronV2FTM
        '0x99d8a9c45b2eca8864373a26d1459e3dff1e17f3'.toUpperCase(), // KashiPairMediumRiskV2
    ]
    if (masterContracts.indexOf(event.params.masterContract.toHex().toUpperCase()) > -1) {
        cauldron.create(event.params.cloneAddress)
    }
}

export function handleLogDeployArbitrum(event: LogDeploy): void {
    let cauldronContracts = [
        '0xC89958B03A55B5de2221aCB25B58B89A000215E6'.toUpperCase(), // weth cauldron
    ]
    if (cauldronContracts.indexOf(event.params.cloneAddress.toHex().toUpperCase()) > -1) {
        cauldron.create(event.params.cloneAddress)
    }
}

export function handleLogDeployAvalanche(event: LogDeploy): void {
    let masterContracts = [
        '0xc568a699c5b43a0f1ae40d3254ee641cb86559f4'.toUpperCase(), // CauldronV2Multichain
        '0x02e07b6f27e5ec37ca6e9f846b6d48704031625a'.toUpperCase(), // CauldronV2Multichain
    ]
    if (masterContracts.indexOf(event.params.masterContract.toHex().toUpperCase()) > -1) {
        cauldron.create(event.params.cloneAddress)
    }
}

export function handleLogDeployBsc(event: LogDeploy): void {
    let masterContracts = [
        '0x26fa3fffb6efe8c1e69103acb4044c26b9a106a9'.toUpperCase(), // CauldronV2Multichain
    ]
    if (masterContracts.indexOf(event.params.masterContract.toHex().toUpperCase()) > -1) {
        cauldron.create(event.params.cloneAddress)
    }
}
