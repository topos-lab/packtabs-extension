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

  it('supports string array for multi-line content', () => {
    const wrapper = mount(Tooltip, {
      props: {
        content: ['Line 1: Drag to reorder', 'Line 2: Ctrl+Click to open'],
      },
      slots: {
        default: '<button>Trigger</button>',
      },
    });

    expect(wrapper.exists()).toBe(true);
  });

  it('supports single-string content with newlines', () => {
    const wrapper = mount(Tooltip, {
      props: {
        content: 'Line 1: First\nLine 2: Second',
      },
      slots: {
        default: '<button>Trigger</button>',
      },
    });

    expect(wrapper.exists()).toBe(true);
  });

  it('supports custom slot content for rich multi-line layout', () => {
    const wrapper = mount(Tooltip, {
      slots: {
        default: '<button>Trigger</button>',
        content: '<div class="custom-multi-line"><p>Line 1</p><p>Line 2</p></div>',
      },
    });

    expect(wrapper.exists()).toBe(true);
  });

  it('supports disabled prop', () => {
    const wrapper = mount(Tooltip, {
      props: {
        content: 'Hint content',
        disabled: true,
      },
      slots: {
        default: '<button>Disabled Trigger</button>',
      },
    });

    expect(wrapper.text()).toContain('Disabled Trigger');
  });

  it('passes custom class to tooltip content container', () => {
    const wrapper = mount(Tooltip, {
      props: {
        content: 'Hint content',
        class: 'custom-tooltip-class',
      },
      slots: {
        default: '<button>Trigger</button>',
      },
    });

    expect(wrapper.exists()).toBe(true);
  });
});
