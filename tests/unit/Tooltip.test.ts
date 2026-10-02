import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import { Tooltip } from '../../components/ui/tooltip';

describe('Tooltip Component', () => {
  it('renders trigger element without crashing', () => {
    const wrapper = mount(Tooltip, {
      props: {
        content: 'Hint content',
      },
      slots: {
        default: '<button class="my-trigger">Hover Me</button>',
      },
    });

    const trigger = wrapper.find('.my-trigger');
    expect(trigger.exists()).toBe(true);
    expect(trigger.text()).toBe('Hover Me');
  });
});
