import type { ParamMatcher } from '@sveltejs/kit';
import { isValidSlug } from '$lib/utils/slug';

export const match: ParamMatcher = (param) => isValidSlug(param);
