import { LogDeploy } from '../generated/degenbox/degenbox'
import { cauldron } from '../generated/templates'

// watching bentobox for contracts deployed by abra
const ABRA_ACCOUNTS = [
    '0xfddfe525054efaad204600d00ca86adb1cc2ea8a'.toLowerCase(),
    '0xb4EfdA6DAf5ef75D08869A0f9C0213278fb43b6C'.toLowerCase()
]

export function handleLogDeploy(event: LogDeploy): void {
    const account = event.transaction.from.toHex().toLowerCase()

    if (ABRA_ACCOUNTS.indexOf(account) > -1) {
        cauldron.create(event.params.cloneAddress)
    }
}
