import {lazy,type ComponentType} from 'react';
import type {PageId} from './routes';
import UnitPage from './Unit';
import type {UnitIdentity} from './unit-state';

// The Record type and navigation coverage test reject a renderer/policy mismatch.
export const pageComponents = {
 training:lazy(()=>import('./App')),
 rapid:lazy(()=>import('./RapidID')),
 unit:UnitPage,
 instructor:lazy(()=>import('./Instructor')),
 analytics:lazy(()=>import('./Analytics')),
 exercises:lazy(()=>import('./ExerciseStudio')),
 recorded:lazy(()=>import('./Recorded')),
 transfer:lazy(()=>import('./Transfer')),
 evidence:lazy(()=>import('./Evidence')),
 evaluation:lazy(()=>import('./Evaluation')),
 benchmark:lazy(()=>import('./Benchmark')),
} satisfies Record<PageId,ComponentType<{identity?:UnitIdentity}>>;
