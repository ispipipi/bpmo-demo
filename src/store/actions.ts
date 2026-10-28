import type { ArcopOp } from '../domain/arcop'
import type { MpiOp } from '../domain/certification'
import type { AlertOp } from '../domain/alertOps'
import type { CommitteeOp } from '../domain/committee'
import type { ConsentOp } from '../domain/consent'
import type { FindingOp } from '../domain/finding'
import type { ProjectOp } from '../domain/projects'
import type { Params } from '../domain/types'
import type { VendorOp } from '../domain/vendors'
import type { RatOp } from '../domain/rat'
import type { Role } from '../domain/role'

export type Action =
  | { type: 'setRole'; role: Role }
  | { type: 'syncApplied' }
  | { type: 'syncFailed' }
  | { type: 'armFailure'; on: boolean }
  | { type: 'reset' }
  | { type: 'arcop'; op: ArcopOp }
  | { type: 'rat'; op: RatOp }
  | { type: 'mpi'; op: MpiOp }
  | { type: 'finding'; op: FindingOp }
  | { type: 'consent'; op: ConsentOp }
  | { type: 'vendor'; op: VendorOp }
  | { type: 'project'; op: ProjectOp }
  | { type: 'committee'; op: CommitteeOp }
  | { type: 'alert'; op: AlertOp }
  | { type: 'setParams'; params: Params }
  | { type: 'resetParams' }
  | { type: 'minuta' }
