import React from 'react';
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { TableShell } from './TableShell';

describe('TableShell', () => {
  it('renders the felt and frame layers', async () => {
    await render(<TableShell />);
    expect(screen.getByTestId('table-shell-felt')).toBeTruthy();
    expect(screen.getByTestId('table-shell-frame')).toBeTruthy();
  });

  it('renders seat content only for seats that were provided', async () => {
    await render(<TableShell seats={{ top: <Text>You</Text>, bottom: <Text>South AI</Text> }} />);
    expect(screen.getByTestId('table-shell-seat-top')).toBeTruthy();
    expect(screen.getByTestId('table-shell-seat-bottom')).toBeTruthy();
    expect(screen.queryByTestId('table-shell-seat-left')).toBeNull();
    expect(screen.queryByTestId('table-shell-seat-right')).toBeNull();
    expect(screen.getByText('You')).toBeTruthy();
    expect(screen.getByText('South AI')).toBeTruthy();
  });

  it('renders center content over the felt', async () => {
    await render(
      <TableShell>
        <Text>Center pile</Text>
      </TableShell>
    );
    expect(screen.getByText('Center pile')).toBeTruthy();
  });

  it('applies no transform by default (flat)', async () => {
    await render(<TableShell />);
    const table = screen.getByTestId('table-shell');
    const styleArray = Array.isArray(table.props.style) ? table.props.style : [table.props.style];
    expect(styleArray.some((s: any) => s != null && s.transform != null)).toBe(false);
  });

  it('applies the perspective tilt transform when tilt is true', async () => {
    await render(<TableShell tilt />);
    const table = screen.getByTestId('table-shell');
    const styleArray = Array.isArray(table.props.style) ? table.props.style : [table.props.style];
    const transformStyle = styleArray.find((s: any) => s != null && s.transform != null);
    expect(transformStyle.transform).toEqual([{ perspective: 1400 }, { rotateX: '20deg' }]);
  });
});
